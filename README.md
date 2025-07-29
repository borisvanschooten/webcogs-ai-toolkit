# Webcogs AI Toolkit
Minimalist AI toolkit for the browser, node.js, and web development. Currently based on the OpenAI API backend, so you will need an OpenAI API account to use it. Provides:

- fully client-side chatbot with tool and app building facilities
- experimental AI-oriented prompts-as-code and LLM-as-compiler web app building framework, based on modular prompts and a kernel/plugin architecture

## The chatbot

This is a simple chatbot, but it enables direct access to [function/tool calling functionality](https://platform.openai.com/docs/guides/function-calling?api-mode=responses).  Standard tools are available for creating apps and new tools, and run code.  So, the AI can create its own tools, and can directly create browser apps that are run in iframes. 

Just start apps/chatbot/index.html in the browser. You do not need a web server.  It will ask for an OpenAI API key, which is stored in the browser's localStorage.  Note that your key is only safe if:

- the chatbot is run from a local file (localStorage access scope is limited to that file in all major browsers)
- or: the chatbot is run from a domain you fully control (otherwise malicious code from the same domain can access it)
- no others have access to your browser.

So it's *not* safe if you run it directly from a github proxy like githack.

There is also a credentials manager for tools that require credentials to function (such as the google search API). These credentials are also stored in localStorage.  

Tools can be imported and exported in JSON format.  Some ready to use tools are included in the aitools/ folder.  During chat, tools can be enabled and disabled via the checkmarks next to the tools.

### Recompile the OpenAI JS library for the browser

The toolkit comes with a pre-compiled browser-compatible version of the OpenAI JS library (lib/openai-bundle.js). This is normally used for server-side AI, but is compiled for browser use using browserify. 

To regenerate the browser bundle, first install node.js and npm.  Then install browserify and openai via npm install (see package.json).  Once installed, run "bundle-openai.sh" to regenerate the file.

## Webcogs app building toolkit: using the LLM as a compiler

I find AI generated code is often accurate enough to use the AI like a *regular (powerful but slow and unreliable) compiler* that compiles specifications into code, without having to revert to idiosyncratic prompt engineering.  However, this only works if the prompt is small and clear enough, written in sufficiently technical language, is without distractions, and the subject matter is sufficiently well-known.  The current generation of AI coding tools and agents are not good enough to build or maintain large software bases, so there is still the need for a human architect.  So, in order to make this *LLM-as-compiler* concept work for real-life problems, software has to be organized in a certain way.  A main goal of software engineering is to make complex software manageable for humans. In the age of AI, I think there should also be something like *AI-oriented software engineering*.  

The Webcogs toolkit is basically an AI-oriented software engineering experiment to find out what works and what doesn't.  First of all, it is based on the *prompts-as-code* principle.  Normally, developers write a prompt to generate code, then they keep the code, but throw away the prompt.  The prompts-as-code concept turns this around: prompts are specifications, so they should not only be kept, but also managed using software engineering principles, such as modularity and version control.  The more prompts are treated as first-class citizens, the more easily code can be re-generated reliably.

The envisioned development process looks something like this: software is subdivided into modules, some of which are fully AI-generated, while others are manually managed. The AI-generated modules are still tested and inspected by the developers, so this is not like vibe coding. Problems with generated modules can be resolved by improving the prompts rather than direct code editing.

The Webcogs app building toolkit provides experimental solutions in two key areas:

- Language and framework agnostic build tools, which support modular prompt structuring. This allows building a prompt out of select parts of the core specifications, such as API docs and SQL and CSS definitions, along with module-specific prompt text.  It also includes a diff tool which shows differences between the current prompt and the prompt with which particular code was generated.  It makes it easier to update AI generated code when specifications are updated, and fix issues with the AI generated code with prompt engineering rather than direct changes in the code.  Currently two command line tools are provided, with a VS code extension on the way:
  - **buildcog** - Build and diff single-file modules.  Reads prompts from a prompt manifest that contains specifications for a set of modules, enabling handling of multiple modules with a single command. 
  - **updatecogsinplace** - Modify files containing @cogs directives, which allow specific comments to be interpreted as prompts, and insert generated code at particular places while leaving the rest of the file as-is.
- a framework that provides specific ways to structure your software in an AI friendly way, in particular a core/plugin structure for web apps, and a translation tool. The core app is a HTML single page application, where the plugins handle specific pages and widgets.


### Passing OpenAI API key

You can pass the API key for OpenAI calls via the environment variable **OPENAI_API_KEY**. E.g. in Bash:

```
export OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
```


### Using buildcog + a prompt manifest to generate code in separate files

Webcogs provides the **buildcog** tool, which takes a json file called a *prompt manifest*, which is like a Makefile.  It uses this file to build a prompt, then calls a LLM, and outputs the AI generated code to a target file. The prompt manifest defines the LLM model, prompts, and build targets.  It enables you to structure your prompts in a modular framework-agnostic way.  

You can run the tool with a node command:
```
node clitools/build_ai_module.js <parameters>
```

Or you can install the command line tool via:
```
npm install -g .
```

This will install the build script under the shell command **buildcog**. 

Prompt manifest format is as follows:

```json
{
	"name": "Ticketing App",
	"description": "Simple demo app for demonstrating WebCogs plugins",
	"version": "0.1",
	"ai_vendor": "openai",
	"ai_model": "o3",
	"system_prompts": [
		{ "file": "../../js/webcogs_core_docs.md" },
		{ "file": "app_docs.md" },
		{ "text": "\n## CSS definitions\n\n", "file": "basestyles.css"},
		{ "text": "\n## SQL table definitions\n\n", "file": "datamodel.sql"}
	],
	"wd": "plugins/",
	"targets": [
		{
			"name": "login",
			"prompts": [ { "file": "login/plugin_docs.md" } ],
			"file": "login/plugin.js"
		},
		{
			"name": "sidebar_tickets",
			"prompts": [ { "text": "Create a widget that shows in the sidebar, showing a vertical list of all open tickets, sorted by date. Open tickets are tickets for which response = NULL.  If you click on a ticket, route to ticket_overview." } ],
			"file": "sidebar_tickets/plugin.js"
		},
		[...]
	]
}
```

ai_vendor and ai_model refer to the LLM to use. Currently only openai is supported.  In system_prompts you can define a series of prompts. They are simply concatenated and fed into the LLM as the system prompt.  In targets you can define multiple build targets, each with its own prompts and output file.  For each build target, you can again define a series of prompts which are concatenated to form the user prompt used to generate the code. 

The buildcog command line tool can now be used to build targets.  For example, you can use the following command to re-generate plugins for the example app:

```
buildcog build <target_name> [<target name> ... ] apps/webcogs-example-app/manifest.json
```

**build** is the command to generate code, **\<target_name\>** is the name of the target(s) to build (e.g. **mainmenu**). The target **all** refers to all targets.

The generated JS files contain the used prompts in a comment at the beginning. This makes the file self-contained, as all underlying context specifications are right there in the generated file.  It does make the files larger, so you may want to minify them or strip the comments in production.  

You can use buildcog's **diff** command to check if the prompt has changed w.r.t. the prompt that was used to generate the file:

```
buildcog diff mainmenu apps/webcogs-example-app/manifest.json
```

This outputs the prompt differences to the console. You can use this to decide when to re-generate the plugin code. 

If you don't want to check prompt changes for every target, but just rebuild them in case the prompts have changed, use the **build-changed** command.  So you can use:

```
buildcog build-changed all apps/webcogs-example-app/manifest.json
```
This will build all targets for which the prompts have changed.

Note that the build tool has **no** way to see if the generated code was hand-edited, so it will happily overwrite your manual changes when building.  If generated code cannot be fixed using prompt engineering, maybe it's not suitable for fully automatic generation, and should be handled differently.

### Using updatecogsinplace to generate specific functions in a file

Webcogs provides a second tool, **updatecogsinplace**, which can be used to generate code inside a file that mixes manually managed and AI generated code.  By using directives inside multiline comments, you can define prompts for specific functions. Basically, you write the documentation for a function, and the AI generates the function in place.   

You can run the tool with a node command:
```
node clitools/update_functions_inplace.js <parameters>
```

Or you can install the command line tool via:
```
npm install -g .
```

This will install the build script under the shell command **updatecogsinplace**. 

A file with webcogs directives looks like this:

```javascript
/*
@cogs_system_prompt
@cogs_include "backend.md"
## MySQL data structure
@cogs_include "../../webcogs-example-app/datamodel.sql"
*/

/* Manually managed code */

var org_id = 1
var db = new SQLDb("/db/run","my_auth_cookie")
var core = new MyCore(db)
[...]

/**@cogs_func getTicketsByOrganization
* Returns all tickets assigned to a particular organization. Includes info on the user it was submitted by and the organization it was assigned to.
* @param core
* @param organization_id
* @returns array of {ticket_id,ticket_text,ticket_time,ticket_status, user_id, username, user_email, organization_id, organization_name}
*/

/* The section between @cogs_func and @cogs_endfunc will be replaced with AI generated code. */

/*@cogs_endfunc*/

/* More manually managed code */

var tickets = getTicketsByOrganization(core,org_id)
console.log(tickets)
[...]
```

All directives start with **@cogs** and are inside multiline comments. Single-line comments are ignored.  At the top of the file, there is a **@cogs_system_prompt**.  Everything in the comment after this directive is taken literally as the system prompt, except for **@cogs_include "\<filepath\>"** which can be used to include a file at that position.  You can have multiple system prompt sections, which are simply concatenated.  System prompts will only be used for functions that are lexically below them.

For every to-be-generated function, you add a **@cogs_func <funcname>** directive.  Everything in the comment below the directive is taken as part of the user prompt to generate a function.  Again, **@cogs_include "\<filepath\>"** can be used to include files. Note that the docs are just JSDoc style documentation, using directives like @param and @returns, which most LLMs handle well.  The user prompt is prefixed with the following fixed prompt:

> Create a function named '"+funcname+"' according to the following specifications.  These must specify the function parameters and format of the return value precisely and unambiguously. If the function parameters or return value are not clear, call report_error instead of create_function. Do not write function documentation. Only call tools, do not explain what you have done.

So, the AI is expressly told to check if the docs are precise enough, and produce an error if not.  The error will show up as a single-line comment starting with **@cogs_func_error**, where the generated code would normally be placed.  This produces quite meaningful error messages in my experience.  Without this instruction, the AI will usually try to guess what the user wants, even if the prompt obviously contains errors or ambiguities.

When code is generated, it is inserted between **@cogs_func** and the next multiline comment that contains the directive **@cogs_endfunc**.  So, if you forget the **@cogs_endfunc**, it may replace the contents of the entire file, so be careful not to forget them.  Note that **@cogs_func** is "self-closing", HTML tag style.  A new comment containing **@cogs_func** will automatically close the previous function section, and **@cogs_endfunc** is added automatically at generation.

Once you have created a source file with the right directives in place, you can generate the code using the following command:

```
updatecogsinplace <funcname> [ <funcname> ... ] <filename>
```

The current version will not overwrite the original file, but create a new file \<filename\>-generated.js.  This will be changed when the tool is more mature.  Note you can use "all" to generate all functions. There is an example with webcogs directives in the folder *apps/test-inplace*.  For example, you can generate the *getUsers* function with the following command:

```
updatecogsinplace getUsers apps/test-inplace/backend/index.js
```

#### updatecogsinplace VSCode extension

There is now a VSCode extension, which is a separate node package in the folder *vscode-extension/webcogs/*.  This extension adds a codelens for each @cogs_func directive, allowing you to generate each function from the editor with click of a button.

This is not on the marketplace yet, but you can install it via a WSIX file.  For more instructions, see *vscode-extension/webcogs/README.md*.

### WebCogsCore HTML app framework

WebCogsCore can be used to write a HTML single page application (SPA), which is divided into a hand crafted core and AI-generated plugins. Interaction between core and plugins is handled by the WebCogsCore class, which only has a handful of functions.  This way, the plugins only have to deal with a combination of well-established knowledge (e.g. vanilla HTML, Javascript, MySQL) and a small core API. You can easily subclass the WebCogsCore to add your own functions.

The core can be a single HTML page which basically does the following:

- define a layout template in HTML
- create a database and an instance of WebCogsCore
- Load the plugins
- Init the plugins you want to display first
- Handle routes coming from the plugins and init new plugins as appropriate
- Optionally handle widget mounts coming from the plugins

WebCogsCore functions for the app:
- loadPlugin(pluginPath,name): (Pre)load plugin
- loadPlugins(appRoot,manifestFile): (Pre)load plugins from manifest
- initPlugin(name): start the plugin

WebCogsCore functions for plugins:
- core.route(route,...params) - invoke router
- core.mount(location, html_code, css_code) - mount a html element on the page

WebCogsCore also comes with a simple SQL interface for handling data.

A plugin always consists of a single class with a constructor that initialises the plugin and any associated widgets.  A WebCogsCore object is passed in, through which the plugin has access to the core API. Constructing a new instance resets the state of the plugin.  Custom arguments can be used to pass specific information to the constructor.

### Multilinguality

A translate tool based on gettext style translation is now available.  Basically you wrap all literal texts in your code in a function, and the function will translate it if there's a translation table available. The core functions for this are:

- core.translate(text)
- core.loadTranslations(language_code)

The example app has multilinguality.  The following global prompt is used to instruct the code generating AI to wrap the literals:

> This is a multilingual application. Run all literal strings / texts in the code and HTML through core.translate(). Do not write your own wrapper function, always call core.translate directly.

This is enough to automatically wrap almost all literal strings.  The tool translate.js can now be used to extract the literal strings from the function calls using xgettext-js.  The strings are then fed into an AI to provide automatic translations and saved to a JSON file.  The following command line will get all strings from the example app plugins and put them in a JSON translation table:

```
node.exe clitools/translate.js Italian apps/webcogs-example-app/i18n/it_it.json apps/webcogs-example-app/plugins/*/plugin.js
```

If I decide to keep this new multilinguality scheme, it seems logical to eventually include it in the buildcog tool.

### Example WebCogs app

An example WebCogs application is found in apps/webcogs-example-app/.  The app has to be run from a webserver that also provides SQL and auth endpoints. A simple webserver with example data for the app is provided. Run it with:
```
node ./clitools/webserver.js
``` 
Now, you can run the app from http://localhost:3000/apps/webcogs-example-app/index.html.

Log in with username: alan, pasword: admin.

## Future work

This framework is very much in the experimental stage, and there is obviously a lot to be done. For example:

- Suitable test harness
- Handling browser navigation (e.g. the back button and URL rewriting)
- Multiple output files in one target
- More extensive core-plugin architecture for handling other things, like algoritms and backends
- Support for more AI vendors and local models
- Clean up package structure and create a npm package

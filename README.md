# Webcogs AI Toolkit
Minimalist AI toolkit for the browser, node.js, and web development. Currently based on the OpenAI API backend, so you will need an OpenAI API account to use it. Provides:

- fully client-side chatbot with tool and app building facilities
- experimental AI-oriented prompts-as-code and LLM-as-compiler web app building framework, based on modular prompts and a kernel/plugin architecture

## The chatbot

Just start apps/chatbot/index.html in the browser. You do not need a web server.  It will ask for an OpenAI API key, which is stored in the browser's localStorage.  Note that your key is only safe if:

- the chatbot is run from a local file (localStorage access scope is limited to that file in all major browsers)
- or: the chatbot is run from a domain you fully control (otherwise malicious code from the same domain can access it)
- no others have access to your browser.

So it's *not* safe if you run it directly from a github proxy like githack.

This is a simple chatbot, but it enables direct access to [function/tool calling functionality](https://platform.openai.com/docs/guides/function-calling?api-mode=responses).  Standard tools are available for creating apps and new tools, and run code.  So, the AI can create its own tools, and can directly create browser apps that are run in iframes. There is a credentials manager for tools that require credentials to function (such as the google search API). These credentials are also stored in localStorage.  

Tools can be imported and exported in JSON format.  Some ready to use tools are included in the aitools/ folder.  During chat, tools can be enabled and disabled via the checkmarks next to the tools.

### Recompile the OpenAI JS library for the browser

The toolkit comes with a pre-compiled browser-compatible version of the OpenAI JS library (lib/openai-bundle.js). This is normally used for server-side AI, but is compiled for browser use using browserify. 

To regenerate the browser bundle, first install node.js and npm.  Then install browserify and openai via npm install (see package.json).  Once installed, run "bundle-openai.sh" to regenerate the file.

## Webcogs app building toolkit

The basic idea behind the Webcogs app building toolkit is a kernel-plugin architecture, in which a hand-crafted kernel (aka core) orchestrates a set of plugins ('cogs') which can be completely AI generated.  This takes the prompts-as-code idea a step further, by *using the LLM like a regular (powerful but slow and unreliable) compiler* that compiles specifications into code, but only for certain manageable and well-defined parts of your code. The toolkit provides two things:

- a framework agnostic prompts-as-code build tool which supports modular prompt structuring.  This allows building a prompt out of select parts of the core specifications, such as API docs and SQL and CSS definitions, along with plugin-specific prompt text.  It also includes a diff tool which shows differences between the current prompt and the prompt with which particular code was generated.  It makes it easier to update AI generated code when specifications are updated, and fix issues with the AI generated code with prompt engineering rather than direct changes in the code. 
- a framework that provides a specific core/plugin structure for web apps. The core app is a HTML single page application, where the plugins handle specific pages and widgets.

### Using buildcog + a prompt manifest to structure prompts

Webcogs provides the **buildcog** tool, which takes a json file called a *prompt manifest* which it uses to build a prompt, then calls a LLM, and outputs the AI generated code to a target file. The prompt manifest defines the LLM model, prompts, and build targets.  It enables you to structure your prompts in a modular framework-agnostic way.  

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
		{
			"name": "ticketadmin",
			"prompts": [ { "file": "ticketadmin/plugin_docs.md" } ],
			"file": "ticketadmin/plugin.js"
		},
		[...]
	]
}
```

ai_vendor and ai_model refer to the LLM to use. Currently only openai is supported.  In system_prompts you can define a series of prompts. They are simply concatenated and fed into the LLM as the system prompt.  In targets you can define multiple build targets, each with its own prompts and output file.  For each build target, you can again define a series of prompts which are concatenated to form the user prompt used to generate the code. 

The buildcog command line tool can now be used to build targets.  You first have to pass the OpenAI API key in a secrets.js file. See secrets-example.js for an example.  Once you defined the key, you can use the following command to re-generate plugins for the example app:

```
buildcog build <target_name> apps/webcogs-example-app/manifest.json
```

**build** is the command to generate code, **\<target_name\>** is the name of the target to build (e.g. **mainmenu**). The target **all** refers to all targets.

The generated JS files contain the used prompts in a comment at the beginning. This is an easy way to include essential metadata in the generated files, and I find it useful to see the prompt when reviewing the generated code.  It does make the files larger, so you may want to minify them or strip the comments in production.  

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

### WebCogsCore app framework

An app is divided into a (hand crafted) core and (AI-generated) plugins. Interaction between core and plugins is handled by the WebCogsCore class, which only has a handful of functions.  This way, the plugins only have to deal with a combination of well-established knowledge (e.g. vanilla HTML, Javascript, MySQL) and a small core API.

The core is a HTML application, which basically does the following:

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

### Example WebCogs app

An example WebCogs application is found in apps/webcogs-example-app/.  The app has to be run from a webserver that also provides SQL and auth endpoints. A simple webserver with example data for the app is provided. Run it with:
```
node ./clitools/webserver.js
``` 
Now, you can run the app from http://localhost:3000/apps/webcogs-example-app/index.html.

Log in with username: admin, pasword: admin.

## Future work

This framework is very much in the experimental stage, and there is obviously a lot to be done. For example:

- Suitable test harness
- Handling browser navigation (e.g. the back button)
- Multiple output files in one target
- More extensive core-plugin architecture for handling other things, like algoritms and backends
- Support for more AI vendors and local models
- Clean up package structure and create a npm package

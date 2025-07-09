# Webcogs AI Toolkit
Minimalist AI toolkit for the browser and web development. Currently based on the OpenAI API backend, so you will need an OpenAI API account to use it.

Provides:
- simple browser library to use the OpenAI API in the browser or node.js, focused on OpenAI's tool/function calling functionality.
- fully client-side chatbot with tool and app building facilities
- experimental AI-first prompt-as-code web app building framework, based on node.js and a kernel/plugin architecture

## The chatbot

Just start apps/chatbot/index.html in the browser. You do not need a web server.  It will ask for an OpenAI API key, which is stored in the browser's localStorage.  Note that your key is only safe if:

- the chatbot is run from a local file (localStorage access scope is limited to that file)
- the chatbot is run from a domain you fully control (otherwise malicious code from the same domain can access it)
- no others have access to your browser environment.

So it's *not* safe if you run it directly from a github proxy like githack.

This is a simple chatbot, but it enables direct access to [OpenAI's function/tool calling functionality](https://platform.openai.com/docs/guides/function-calling?api-mode=responses).  Standard tools are available for creating apps and new tools, and run code.  So, the AI can create its own tools, and can directly create browser apps that are run in iframes. There is a credentials manager for tools that require credentials to function (such as the google search API). These credentials are also stored in localStorage.  

Tools can be imported and exported in JSON format.  Some ready to use tools are included in the aitools/ folder.  During chat, tools can be enabled and disabled via the checkmarks next to the tools.

### Recompile the OpenAI JS library for the browser

The toolkit comes with a pre-compiled browser-compatible version of the OpenAI JS library (lib/openai-bundle.js). This is normally used for server-side AI, but is compiled for browser use using browserify. 

To regenerate the browser bundle, first install node.js and npm.  Then install browserify and openai via npm install (see package.json).  Once installed, run "bundle-openai.sh" to regenerate the file.

## Webcogs app building framework

The basic idea behind the Webcogs app building framework is a kernel-plugin architecture, where the kernel (aka core) is carefully hand-crafted, but the plugins can be written completely by AI.  The plugins only have to deal with a combination of well-established knowledge (e.g. vanilla HTML, Javascript, MySQL) and a small core API.

The core is basically a HTML application.  It provides a screen layout template, defining elements on which plugins can mount widgets, and a router which determines how UI flow is handled.  Interaction between core and plugins is handled by the WebCogsCore class, which only has a handful of functions.

Core functions for apps:
- loadPlugin(pluginPath,name): (Pre)load plugin
- initPlugin(name): start the plugin

Core functions for plugins:
- core.route(route,...params) - invoke router
- core.mount(elementID, html_code, css_code) - mount a html element on the page as a shadow DOM

WebCogsCore also comes with a simple SQL interface for handling data.

### Building an app with WebCogs

Create the core HTML page which does the following:

- define a layout template
- create a database and an instance of WebCogsCore
- Load the plugins
- Init the plugins you want to display first
- Handle routes coming from the plugins

Create plugins by defining a prompt manifest for each plugin.  This defines the LLM model and prompts to use, and the output files.  It enables you to structure your prompts in a modular framework-agnostic way.  This can be used stand-alone, separate from the WebCogsCore web framework. The build_ai_module tool takes a json prompt manifest, calls a LLM, and outputs the AI generated code to one or more target files. Format is as follows:

```json
{
	"name": "useradmin",
	"description": "user admin",
	"vendor": "openai",
	"model": "o3",
	"system_prompts": [
		{ "file": "js/webcogs_core_docs.md" },
		{ "file": "apps/webcogs-example-app/app_docs.md" }
	],
	"outputs": [
		{
			"type": "code",
			"prompts": [ { "file": "apps/webcogs-example-app/plugins/useradmin/plugin_docs.md" } ],
			"target": "apps/webcogs-example-app/plugins/useradmin/plugin.js"
		}
	]
}
```

Vendor and model refer to the LLM to use. Currently only openai is supported.  In system_prompts you can define a series of prompts. They are simply concatenated and fed into the LLM as the system prompt.  In outputs you can define multiple target files, each with its own prompts.  Again you can define multiple prompts which are concatenated to form the user prompt used to generate the code. 

The plugin code is generated through a call to the create_plugin tool. A plugin consists of a single class with a constructor that initialises the plugin and any associated widgets.  A WebCogsCore object is passed in, through which the plugin has access to the core API.

An example application is found in apps/webcogs-example-app/

To regenerate the plugins, you first have to pass the OpenAI API key in a secrets.js file. See secrets-example.js for an example.  Once you defined the secret, use the following commands:

```
node clitools/build_ai_module.js build apps/webcogs-example-app/plugins/useradmin/manifest.json
node clitools/build_ai_module.js build apps/webcogs-example-app/plugins/ticketadmin/manifest.json
node clitools/build_ai_module.js build apps/webcogs-example-app/plugins/mainmenu/manifest.json
node clitools/build_ai_module.js build apps/webcogs-example-app/plugins/user_overview/manifest.json
node clitools/build_ai_module.js build apps/webcogs-example-app/plugins/ticket_overview/manifest.json
```

The example app has to be run from a webserver that also provides an SQL endpoint. A simple webserver with example data for the example app is provided. Run it with:
```
node ./clitools/webserver.js
``` 

The generated JS files contain the used prompt in a comment at the beginning.  You can use the build tool to check if the prompt has changed w.r.t. the prompt that was used to generate the file. Use the diff command:

```
node clitools/build_ai_module.js diff apps/webcogs-example-app/plugins/useradmin/manifest.json
```

This outputs the differences to the console. You can use this to decide when to re-generate the plugin code.

# Webcogs AI Toolkit
Minimalist AI toolkit for the browser. Currently based on the OpenAI API backend, so you will need an OpenAI API account to use it.

Provides:
- simple browser library to use the OpenAI API in the browser, focused on OpenAI's tool/function calling functionality.
- fully client-side chatbot with tool and app building facilities

## Run the chatbot

Just start apps/chatbot/index.html in the browser. You do not need a web server.  It will ask for an OpenAI API key, which is stored in the browser's localStorage.  Note that your key is only safe if:

- the chatbot is run from a local file (localStorage access scope is limited to that file)
- the chatbot is run from a domain you fully control (otherwise malicious code from the same domain can access it)
- no others have access to your browser environment.

So it's *not* safe if you run it directly from a github proxy like githack.

This is a simple chatbot, but it enables direct access to [OpenAI's function/tool calling functionality](https://platform.openai.com/docs/guides/function-calling?api-mode=responses).  Standard tools are available for creating apps and new tools, and run code.  So, the AI can create its own tools, and can directly create browser apps that are run in iframes. There is a credentials manager for tools that require credentials to function (such as the google search API). These credentials are also stored in localStorage.  

Tools can be imported and exported in JSON format.  Some ready to use tools are included in the aitools/ folder.

## Recompile the OpenAI JS library

The toolkit comes with a pre-compiled browser-compatible version of the OpenAI JS library (lib/openai-bundle.js). This is normally used for server-side AI, but is compiled for browser use using browserify. 

To regenerate the browser bundle, first install node.js and npm.  Then install browserify and openai via npm install (see package.json).  Once installed, run "bundle-openai.sh" to regenerate the file.

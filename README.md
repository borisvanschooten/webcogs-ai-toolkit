# Webcogs AI Toolkit
Minimalist AI toolkit for the browser. Currently based on the OpenAI API backend, so you will need an OpenAI API account to use it.

Provides:
- simple browser library to use the OpenAI API in the browser, focused on OpenAI's tool/function calling functionality.
- fully client-side chatbot with tool and app building facilities

## Run the chatbot

Just start apps/chatbot/index.html in the browser. You do not need a web server.  It will ask for an OpenAI API key, which is stored in the browser's localStorage.  Note that your key is not safe if others have access to your browser environment.

This is a simple chatbot, but it enables direct access to [OpenAI's function/tool calling functionality](https://platform.openai.com/docs/guides/function-calling?api-mode=responses).  Standard tools are available for creating apps, code, and new tools.  So, the AI can create its own tools, and can directly create browser apps that are run in iframes. There is a credentials manager for tools that require credentials to function (such as the google search API). These credentials are also stored in localStorage.

## Recompile the OpenAI JS library

The toolkit comes with a pre-compiled browser-compatible version of the OpenAI JS library (lib/openai-bundle.js). This is normally used for server-side AI, but is compiled for browser use using broswerify. 

To regenerate the browser bundle, first install node.js and npm.  Then install browserify and openai via npm install (see package.json).  Once installed, run "bundle-openai.sh" to regenerate the file.

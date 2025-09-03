# Webcogs VSCode extension

Part of the Webcogs open source experimental AI software engineering toolkit, which facilitates using **an LLM as a compiler**. The extension provides a CodeLens alternative for the **buildcog** and **buildcogsinplace** command line tools.

## Features

The main idea behind Webcogs is that it allows you to use the **LLM as a compiler**, compiling specifications into code.  Basically you write the docs, and have the AI generate specific functions and classes.  Provides methodical **prompts-as-code** facilities that are complementary to the ad hoc prompting offered by most code generating AI tools. Instead of prompting in a chat line, then throwing away the prompts once the code is generated, prompts can be embedded in the source code or specified via a buildfile.  This allows you to *specify context more precisely and consistently*, which increases generation accuracy.  Also, you can *re-generate code easily when the specifications change*, making it easier to use AI code generation to not just create but also maintain your code. 

- Define prompts via a build file, and generate source files directly from there.

- Put prompts directly in your source code inside comments and generate functions in place.
  - Define context via file-wide system prompts 
  - Easily mix fully AI generated code with hand-crafted code in a single source file.

- Easily include external files in your prompts.

- Compatible with languages that use C-style multiline comments /* ... */.  Specifically compatible with PHP.

## How to use

You have to activate the codelenses from the command palette. Type Shift-Ctrl-P, then select *"Webcogs: Enable Webcogs Codelens"*. 

You need to have an **OpenAI API key**, which you are prompted to fill in when the plugin initialises for the first time.  If you have to re-enter it, use the command *"Webcogs: Re-enter Webcogs OpenAI API Key"*. Note the tool now uses the new GPT-5 model by default, which is supposed to be as good as O3, which gives me good results, and is low-cost (about $0.01 to generate a function, $0.02 to generate a class).

### Building files via a buildfile

For building separate files, you can use a promptbuildfile which is a JSON file defining the build targets and corresponding prompts.  Opening a promptbuildfile in the editor brings up a codelens for each target in the file.  The file looks something like this:

```json
{
	"webcogs_buildfile_version": 1,
	"name": "Ticketing App",
	"description": "Simple demo app for demonstrating WebCogs plugins",
	"version": "0.1",
	"ai_vendor": "openai",
	"ai_model": "gpt-5",
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
Most important are:

- webcogs_buildfile_version: is used to autodetect the buildfile

- system_prompts: lists files and/or text to add to the system prompt

- wd: working directory for build targets

- targets: lists the build targets with their names, prompts, and target files.

For full documentation of the file format, see the github repo:

[https://github.com/borisvanschooten/webcogs-ai-toolkit](https://github.com/borisvanschooten/webcogs-ai-toolkit)


### Building functions inside an existing file

You can augment your source files with @cogs directives inside multiline comments, which indicate prompts with which parts of your code can be generated. It currently supports **C-style multiline comments only** (without nesting), so it works for languages like Java, C, C++, C#, PHP, Javascript, Typescript, CSS. Example:
```javascript
/* The following defines the system prompt for subsequent functions.
@cogs_system_prompt
@cogs_include "systemprompt.md"

## MySQL data structure

@cogs_include "datamodel.sql"

[Enter any other file-wide system prompts here.]
*/

// Your manually crafted code goes here

/** @cogs_func getUsers
* Gets all users from the database.
* @param db - database connection
* @returns Array of user objects with fields {user_id,username,organization_id,first_name,surname,email}
*/

// AI generated code is placed between @cogs_func and @cogs_endfunc
// If Webcogs CodeLens is enabled, you will see a button to generate getUsers

/*@cogs_endfunc*/

// more manually crafted code can be put here
```

There's no accept/reject dialog after generating code yet, but the code generations can be undone with regular undo (Ctrl-Z).

Building a function takes around 10 seconds, but you can build multiple functions in parallel.

For full documentation, see the Github repo:
[https://github.com/borisvanschooten/webcogs-ai-toolkit](https://github.com/borisvanschooten/webcogs-ai-toolkit)

## Extension Settings

This extension contributes the following settings:

* `webcogs.enableCodeLens`: Enable extension.
* `webcogs.disableCodeLens`: Disable extension.

## Known Issues

This is as yet an experimental plugin. Error handling still needs work.

## How to re-build from source

Download the repo. Make sure to install the **vsce** tool:

```
npm install -g @vscode/vsce
```

Go to the repo's vscode-extension/webcogs subdirectory, then:

```
npm run install-local-webcogs
vsce package
```

This will create a vsix package, which you can install in VSCode:
- go to the extensions: marketplace tab
- in the triple dot menu, select "install from VSIX"

# Webcogs VSCode extension

Part of the Webcogs open source experimental AI software engineering toolkit. The extension provides a CodeLens alternative for the **buildcogsinplace** command line tool.

## Features

Provides methodical **prompts-as-code** facilities that are complementary to the ad hoc prompting offered by most code generating AI tools. Instead of prompting in a chat line, then throwing away the prompts once the code is generated, prompts can be embedded in the source code.

- Put prompts directly in your source code inside comments and generate functions in place.

- Define context via file-wide system prompts and include external files in your prompts.

- Easily mix fully AI generated code with hand-crafted code in a single source file.

- Compatible with languages that use C-style multiline comments /* ... */

## How to use

You have to activate the codelens from the command palette. Type Shift-Ctrl-P, then select *"Webcogs: Enable Webcogs Codelens"*. 

You need to have an **OpenAI API key**, which you are prompted to fill in when the plugin initialises.  If you have to re-enter it, use the command *"Webcogs: Re-enter Webcogs OpenAI API Key"*.

There's no accept/reject dialog after generating code yet, but the code generations can be undone with regular undo (Ctrl-Z).

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

## Release Notes

### 0.3.1

First release, with improved docs

# Webcogs VSCode extension

Part of the Webcogs open source experimental AI software engineering toolkit.

## Features

A CodeLens for the **buildcogsinplace** tool, which enables working with AI generated functions inside manually managed code. For docs, see the Github repo:
[https://github.com/borisvanschooten/webcogs-ai-toolkit](https://github.com/borisvanschooten/webcogs-ai-toolkit)

You can activate the codelens from the command palette. Type Shift-Ctrl-P, then select *"Webcogs: Enable Webcogs Codelens."*.

You need to have an OpenAI API key, which you are prompted to fill in when the plugin initialises.  If you have to re-enter it, use the command *"Webcogs: Re-enter Webcogs OpenAI API Key"*.

## Extension Settings

This extension contributes the following settings:

* `webcogs.enableCodeLens`: Enable extension.
* `webcogs.disableCodeLens`: Disable extension.

## Known Issues

This is as yet an experimental plugin.

## How to build

Make sure to install the **vsce** tool:
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

### 0.3.0

First release

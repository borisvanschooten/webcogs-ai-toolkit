// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const path = require('path');
const vscode = require('vscode');
const OpenAI = require("openai");

const {UpdateCogsInPlace,BuildCog} = require('webcogs')
//const CodelensProvider  = require('./CodelensProvider');
console.log(BuildCog)
console.log(UpdateCogsInPlace)

const funcregex = /cogs_func\s+([a-zA-Z0-9_]+)/g;

let disposables = [];

var openaiclient = null;


console.log("Initializing Webcogs extension ...")


class CodelensProvider {

	_onDidChangeCodeLenses = new vscode.EventEmitter();
	onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

	constructor() {
		vscode.workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire();
		});
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.CancellationToken} token
	 * @returns {vscode.CodeLens[]}
	 */
	provideCodeLenses(document, token) {
		try {
			if (!vscode.workspace.getConfiguration("webcogs").get("enableCodeLens", true)) return;
			var codeLenses = [];
			var lines = []
			for (let line = 0; line < document.lineCount; line++) {
				lines.push(document.lineAt(line).text)
			}
			//Detect if this is a promptbuildfile:
			// JSON file with the field: "webcogs_buildfile_version": <versionNr_integer>,
			var text = document.getText()
			if (text.match(/"webcogs_buildfile_version"\s*:\s*[0-9]+/)) {
				console.log("Detected buildfile")
				// detected prompt buildfile, parse JSON
				try {
					var json = JSON.parse(text)
					if (json && json.targets && Array.isArray(json.targets)) {
						for (var i=0; i<json.targets.length; i++) {
							var target = json.targets[i]
							if (target.name) {
								console.log(`Searching for target ${target.name}`)
								// XXX shallow parsing, may detect project name as a target
								var targetregex = new RegExp(`"name"\\s*:\\s*"${target.name}"`)
								for (var l=0; l<lines.length; l++) {
									if (lines[l].match(targetregex)) {
										console.log("Found target")
										const range = new vscode.Range(l, 0, l, lines[l].length);
										codeLenses.push(
											new vscode.CodeLens(range, {
												title: `Rebuild "${target.name}"`,
												tooltip: 'Click to run this function',
												command: 'webcogs.codelensBuildAction',
												arguments: [target.name, "build"]   // passed to the command
											})
										)
									}
								}
							}
						}
					}
					return codeLenses;
				} catch (error) {
					console.log("Error parsing webcogs buildfile: "+error)
					// return any codelenses we already found, otherwise fallback to normal parsing
					if (codeLenses) return codeLenses
				}
			}
			// scan for multiline comments that contain @cogs_func <funcname>. Create a codelens right below the comment.
			var funcName = null // null means no func found 
			var tokens = UpdateCogsInPlace.commentTokenizer(lines, (linenr,charnr,token,insideMultilineComment) => {
				if (insideMultilineComment) {
					if (token.indexOf("@cogs_func") !== -1) {
						var match;
						while ((match = funcregex.exec(token)) !== null) {
							//console.log(`Found ${m[1]} at index ${m.index}`);
							// m[0] = whole match, m[1].. = capture groups
							// TODO emit error if a function was already found
							funcName = match[1]
						}
					}
				} else {
					if (funcName && (charnr == 0 || linenr == document.lineCount-1)) {
						//console.log("Emitting code lens for "+funcName)
						const range = new vscode.Range(linenr, 0, linenr, document.lineAt(linenr).text.length);

						codeLenses.push(
							new vscode.CodeLens(range, {
								title: `Rebuild "${funcName}()"`,
								tooltip: 'Click to run this function',
								command: 'webcogs.codelensAction',
								arguments: [funcName]   // passed to the command
							})
						)
						funcName = null
					}
				}
				//console.log(`${linenr}:${charnr}: "${token}"  State=${insideMultilineComment}`)
			});
			//console.log(tokens.join(""))
		
			
			/*codeLenses = [];
			const regex = /^function\s+(\w+)/;   // naive function matcher

			const editor = vscode.window.activeTextEditor;
			for (let line = 0; line < document.lineCount; line++) {
				const lineText = document.lineAt(line).text;
				const match = regex.exec(lineText);
				if (match) {
					const funcName = match[1];
					const range = new vscode.Range(line, 0, line, lineText.length);


					codeLenses.push(
						new vscode.CodeLens(range, {
							title: `Rebuild "${funcName}()"`,
							tooltip: 'Click to run this function',
							command: 'webcogs.codelensAction',
							arguments: ["function", funcName]   // passed to the command
						})
					);
				}
			}*/
		} catch (error) {
			console.log(error)
		}
		return codeLenses;
	}

	/**
	 *  Optional: called **after** the user expands or hovers the CodeLens.
	 *  Here we simply return the lens unchanged.
	 */
	resolveCodeLens(codeLens, token) {
		return codeLens;
	}
}


function getSecretsFromUser(context) {
	vscode.window.showInputBox({
		title: 'Webcogs requires an OpenAI API Key',
		prompt: 'Please provide an OpenAI API Key to use Webcogs CodeLens',
		placeHolder: 'e.g. sk_proj_iAaW2kl67Sjdv...',
		ignoreFocusOut: true,           // keeps the box open when you switch tabs
		value: '',                      // initial text
		validateInput: (text) => {
			// return a string → shows as error; return undefined/null → OK
			return text.trim().length ? null : 'Please fill in a key';
		}
	}).then( (apikey) => {
		context.secrets.store('webcogs_openai_api_key', apikey);
		// undefined  ⇒ user pressed ESC or clicked the ✖
		if (typeof apikey === 'undefined') {
			vscode.window.showInformationMessage('Input was cancelled.');
			return;
		}
		openaiclient = new OpenAI.OpenAI({apiKey: apikey})
	})
}

// XXX parsing behaviour different from the command line parser
// -> the command line parser parses the directive parameters as well and produces errors on illegal sequences.
// Still, this is a pretty safe way to insert new code as it triggers faster and will overwrite less.
function getInsertRange(document,funcName) {
	var startline=null
	var endline=null
	var foundFuncName = null;
	var lines = []
	var rangeFound = null
	for (let line = 0; line < document.lineCount; line++) {
		lines.push(document.lineAt(line).text)
	}
	var tokens = UpdateCogsInPlace.commentTokenizer(lines, (linenr,charnr,token,insideMultilineComment) => {
		if (rangeFound!== null) return;
		if (startline === null) {
			// scanning for function start
			if (insideMultilineComment) {
				if (token.indexOf("@cogs_func") !== -1) {
					var match;
					while ((match = funcregex.exec(token)) !== null) {
						foundFuncName = match[1]
					}
				}
			} else {
				if (foundFuncName && (charnr == 0 || linenr == document.lineCount-1)) {
					if (foundFuncName == funcName) {
						// setting startline triggers searching for end
						startline = linenr
					}
				}
			}
		} else {
			// scanning for first @cogs directive to close this func
			if (insideMultilineComment) {
				//console.log("#found:"+token+"..."+(token.indexOf("@cogs_endfunc")!==-1))
				if (token.indexOf("@cogs_endfunc") !== -1
				||  token.indexOf("@cogs_func") !== -1
				||  token.indexOf("@cogs_system_prompt") !== -1) {
					rangeFound = new vscode.Range(startline, 0, endline, 0) //document.lineAt(endline).text.length)
				}
			} else {
				if (token == "/*") {
					// start of multiline comment
					if (endline === null) {
						endline = linenr
					}
				} else {
					endline = null
				}
			}
		}
	})
	if (rangeFound) return rangeFound;
	if (startline === null) return null;
	return new vscode.Range(startline, 0, document.lineCount-1, document.lineAt(document.lineCount-1).text.length)
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Activating Webcogs extension ...');


	context.secrets.get('webcogs_openai_api_key').then( (stored_key) => {
		if (!stored_key) {
			getSecretsFromUser(context)
		} else {
			openaiclient = new OpenAI.OpenAI({apiKey: stored_key})
		}
	})
	const codelensProvider = new CodelensProvider();

	vscode.languages.registerCodeLensProvider("*", codelensProvider);

	// The commands have been defined in the package.json file
	// Now provide the implementation with registerCommand
	
	vscode.commands.registerCommand("webcogs.enableCodeLens", () => {
		vscode.workspace.getConfiguration("webcogs").update("enableCodeLens", true, true);
	});

	vscode.commands.registerCommand("webcogs.disableCodeLens", () => {
		vscode.workspace.getConfiguration("webcogs").update("enableCodeLens", false, true);
	});

	vscode.commands.registerCommand("webcogs.enterOpenAIAPiKey", () => {
		getSecretsFromUser(context)
	});

	vscode.commands.registerCommand("webcogs.codelensBuildAction", (targetName,opName) => {
		vscode.window.showInformationMessage(`Building ${targetName}...`);
		console.log("buildAction triggered: "+targetName + " " + opName)
		const editor = vscode.window.activeTextEditor
		const document = editor.document
		const fileName = document.fileName
		var basePath = path.dirname(fileName)
		var buildcog = new BuildCog(openaiclient, opName, [targetName], fileName)
		buildcog.runCommand().then( (err) => {
			vscode.window.showInformationMessage(`Finished building ${targetName}.`);			
		})
	})

	vscode.commands.registerCommand("webcogs.codelensAction", (funcName) => {
		vscode.window.showInformationMessage(`Building ${funcName}...`);
		const editor = vscode.window.activeTextEditor
		const document = editor.document
		const fileName = document.fileName
		var basePath = path.dirname(fileName)
		var parser = new UpdateCogsInPlace(openaiclient, document.getText(), basePath, funcName, "openai", "gpt-5")
		parser.parseFile().then( (update) => {
			//console.log(update.diffs)
			for (var i=0; i<update.diffs.length; i++) {
				var diff = update.diffs[i] 
				if (diff.text === null) continue;
				//var endline = diff.startline + diff.nrlines-3
				//const range = new vscode.Range(diff.startline, 0, endline, document.lineAt(endline).text.length);
				const range = getInsertRange(document,funcName)
				if (range !== null) {
					editor.edit(editBuilder => {
						editBuilder.replace(range, diff.text);
						vscode.window.showInformationMessage(`Finished building ${funcName}.`);
					});
				} else {
					console.log(`Function ${funcName} not found.`)
				}
			}
		})

		/*console.log(args)
		setTimeout(() => {
			vscode.window.showInformationMessage(`CodeLens action clicked for function ${JSON.stringify(args)}`);
			const document = editor.document;
			const selection = editor.selection;
			const word = document.getText(selection);
			const reversed = word.split('').reverse().join('');
			editor.edit(editBuilder => {
				editBuilder.replace(selection, reversed);
			});

		}, 3000);*/
	});

	// The commandId parameter must match the command field in package.json
	//const disposable = vscode.commands.registerCommand('webcogs.helloWorld', function () {
	//	// The code you place here will be executed every time your command is executed
	//	// Display a message box to the user
	//	vscode.window.showInformationMessage('Hello World from WebCogs!');
	//});
	//context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {
	if (disposables) {
		disposables.forEach(item => item.dispose());
	}
	disposables = [];
}

module.exports = {
	activate,
	deactivate
}

const path = require('path');
const fs = require('fs');
const callLLM = require('./call_llm.js');


class UpdateCogsInPlace {
	fileContent;
	basePath;

	buildTargets;

	vendor;
	model;
	client;

	newFileContent = "";
	fileDiffs = [] // array of {startline,nrlines,text}
	system_prompt = "";
	funcname = null;
	func_prompt = "";

	constructor(client,fileContent,basePath,buildTargets,vendor,model) {
		this.fileContent = fileContent
		this.basePath = basePath
		this.buildTargets = buildTargets
		this.vendor = vendor
		this.model = model
		this.client = client
	}

	// AI tools -----------------------

	// XXX startline and nrlines are incorrect, but are not used by the vscode extension. Remove.
	// create new diff with only endline filled in. addText adds the rest.
	initNextDiff(section) {
		this.fileDiffs.push({startline:null, nrlines:section.split('\n').length, text:null});
	}
	addText(text) {
		// TODO get version from package.json?
		var diffText = `//@cogs_build 0.3.1 ${this.vendor}-${this.model} ${new Date().toISOString()}\n`
		diffText += text
		var diffStart = this.newFileContent.split('\n').length;
		this.newFileContent += "\n"+diffText
		// nrlines was already filled in on end of code section
		this.fileDiffs[this.fileDiffs.length-1].startline = diffStart
		this.fileDiffs[this.fileDiffs.length-1].text = diffText
	}
	create_function(args) {
		args.source_code.replaceAll("\r\n","\n")
		this.addText(args.source_code+"\n")
	}
	report_error(args) {
		args.error_message.replaceAll("\r"," ")
		args.error_message.replaceAll("\n"," ")
		this.addText("//@cogs_func_error "+args.error_message+"\n")
	}

	tools = [
		{
			"type": "function",
			"function": {
				"name": "create_function",
				"description": "Create a function. It should be specified in full, do not omit any code. Create just the function itself.",
				"parameters": {
					"type": "object",
					"properties": {
						"source_code": {
							"type": "string",
							"description": "The function code, including function name and parameters",
						},
					},
					"required": [
						"source_code"
					],
					"additionalProperties": false
				},
				"strict": true
			}
		},
		{
			"type": "function",
			"function": {
				"name": "report_error",
				"description": "Reports an error to the user.",
				"parameters": {
					"type": "object",
					"properties": {
						"error_message": {
							"type": "string",
							"description": "The error message, clearly describing the error",
						},
					},
					"required": [
						"error_message"
					],
					"additionalProperties": false
				},
				"strict": true
			}
		},
	];

	// Parsing ------------------------------



	/** Tokenizes source code, emitting comment-delimiter tokens,
	* "text" tokens (any sequence of characters between the delimiters),
	* and "\n" tokens.
	*
	* @param {string[]} text  array of lines to tokenize.
	* @param {function} tokenCallback - func(linenr,charnr,token,insideMultilineComment) 
	* @returns {string[]}   Array of tokens in the order encountered.
	*/
	static commentTokenizer(lines,tokenCallback) {
		const tokens = [];
		let inMulti  = false;  // ‘true’ ⇢ currently inside /* ... */
		
		for (let lineNo = 0; lineNo < lines.length; lineNo++) {
			const line = lines[lineNo];
			let i      = 0;  // character index inside the line
			let startchar = 0; // character index of first character of current token
			let token  = '';

			while (i < line.length) {
				const ch  = line[i];
				const nxt = i + 1 < line.length ? line[i + 1] : '';

				if (!inMulti) {
					if (ch === '/' && nxt === '/') {  // "//" → single-line comment
						if (token) {
							tokenCallback(lineNo,startchar, token, inMulti)
							tokens.push(token); 
							token = '';
						}
						tokens.push('//');
						tokenCallback(lineNo,i, '//', inMulti)
						// rest of this line belongs to "//"
						if (line.length > i+2) {
							tokens.push(line.slice(i+2));
							tokenCallback(lineNo,i, line.slice(i+2), inMulti)
						}
						break;
					} else if (ch === '/' && nxt === '*') {   // "/*" → enter multi
						if (token) {
							tokenCallback(lineNo,startchar, token, inMulti)
							tokens.push(token); 
							token = '';
						}
						tokens.push('/*');
						tokenCallback(lineNo,i, '/*', inMulti)

						inMulti = true;
						i += 2; // consume both characters
						continue;
					}
				} else {
					if (ch === '*' && nxt === '/') {  // "*/" → leave multi
						if (token) {
							tokenCallback(lineNo,startchar, token, inMulti)
							tokens.push(token); 
							token = '';
						}
						tokens.push('*/');
						tokenCallback(lineNo,i, '*/', inMulti)
						inMulti = false;
						i += 2;
						continue;
					}
				}

				// default path: accumulate character into current text token
				if (token === "") startchar = i;
				token += ch;
				i += 1;
			} // end character loop

			// final text fragment of the line
			if (token) {
				tokenCallback(lineNo,startchar, token, inMulti)
				tokens.push(token);
			}
			// EOL is also emitted as token
			tokens.push("\n");
			tokenCallback(lineNo,line.length, "\n", inMulti)
		} // end line loop

		return tokens;
	}


	async writeOldFunc(selfClosing) {
		if (!this.funcname || !this.isBuildTarget(this.funcname)) {
			this.funcname = null
			this.func_prompt = ""
			return;
		}
		if (this.func_prompt != "") {
			// write out previous function
			console.log(`>> Generating ${this.funcname}...`)
			//console.log(system_prompt)
			//console.log(func_prompt)
			this.func_prompt = "Create a function named '"+this.funcname+"' according to the following specifications.  These must specify the function behaviour, parameters, and format of the return value precisely and unambiguously. If the specifications are not clear, call the report_error tool, otherwise the create_function tool. Do not write function documentation. Only call a single tool, do not explain what you have done.\n" + this.func_prompt
			var messages = [
				{
					"role": "developer",
					"content": this.system_prompt,
				},{
					"role": "user",
					"content": this.func_prompt,
				}
			]
			// output is LLM talk, which is ignored
			// forcing tool calls results in calling the tool 3x with the same input (o3-mini)
			var output = await callLLM.callLLM(this.client,messages,this.tools,"aifn_",this,this.model,2,null,2000,"auto")
			console.log("AI chat output:")
			console.log(output)
			if (selfClosing) {
				console.log(">> Self-closing code section.")
				this.newFileContent += "/*@cogs_endfunc*/\n"
			}
			this.funcname = null
			this.func_prompt = ""
		}
	}


	isBuildTarget(funcname) {
		return this.buildTargets.includes(funcname) || this.buildTargets.includes("all")
	}


	// XXX does not handle the case where comment start is in a single line comment (e.g. "// /*"")
	// -> Should be rewritten to use commentTokenizer
	splitIntoSections(source) {
		//var sections = [];
		// this reges crashes node18
		// https://github.com/nodejs/help/issues/4233
		//var regex = /(\/\*[\s\S]*?\*\/)|([\s\S]*?(?=\/\*|$))/g;
		// this regex was created by gpt4o but is incorrect for single line comments
		//var regex = /(\/\*[\s\S]*?\*\/)|([^\/\*]+)/g;
		//var match;
		//
		//while ((match = regex.exec(source)) !== null) {
		//    sections.push(match[0]);
		//}
		const blockRE = /\/\*[\s\S]*?\*\//g;   // non-greedy, DOTALL-like
		const parts   = [];

		let cursor = 0;
		let match;

		// iterate through every /* … */ match
		while ((match = blockRE.exec(source)) !== null) {
			const start = match.index;           // where the comment starts

			// prepend the code that precedes this comment (if any)
			if (start > cursor) {
			parts.push({
				kind : "code",
				text : source.slice(cursor, start)
			});
			}

			// the comment itself
			parts.push({
				kind : "comment",
				text : match[0]
			});

			cursor = start + match[0].length;    // move cursor past this comment
		}

		// any trailing code after the last comment
		if (cursor < source.length) {
			parts.push({
				kind : "code",
				text : source.slice(cursor)
			});
		}

		return parts;
	}

	/** NOTE: Linebreaks of output are normalised to "\n", you have to convert it back to the document linebreak type. */
	async parseFile() {
		// normalise linebreaks
		var fileContent = this.fileContent.replaceAll("\r\n","\n")

		var sections = this.splitIntoSections(fileContent)
		this.newFileContent = ""
		this.fileDiffs = []
		this.system_prompt = ""
		this.funcname = null
		this.func_prompt = ""
		for (var i=0; i<sections.length; i++) {
			var section = sections[i].text
			if (sections[i].kind == "comment") {
				var sec = section.slice(2, -2) // strip comment symbols
				// capture all commands and parameters in separate groups
				var regex2 = /(@cogs_system_prompt)|(@cogs_func)\s+([a-zA-Z0-9_]+)|(@cogs_include)\s+"([^"]+)"|(@cogs_endfunc)/g
				var groups = sec.split(regex2)
				// remove empty capture groups which show up as undefined
				groups = groups.filter(element => element !== undefined);
				var mode = "start" // start, system, func
				var idx = 0
				while (idx < groups.length) {
					//console.log("Mode: "+mode)
					//console.log("Next group: #"+groups[idx]+"#")
					if (mode == "start") {
						if (groups[idx] == "@cogs_system_prompt") {
							await this.writeOldFunc(true)
							mode = "system"
						} else if (groups[idx] == "@cogs_func") {
							await this.writeOldFunc(true)
							this.funcname = groups[idx+1]
							idx += 1
							mode = "func"
						} else if (groups[idx] == "@cogs_include") {
							throw new Error("@cogs_include must be inside system or function prompt")
						} else if (groups[idx] == "@cogs_endfunc") {
							if (this.func_prompt != "") {
								await this.writeOldFunc(false)
							} else {
								throw new Error("@cogs_endfunc without function prompt")
							}
						} else { 
							// bare text -> ignore
						}
					} else if (mode == "system") {
						if (groups[idx] == "@cogs_system_prompt") {
							throw new Error("@cogs_system_prompt while already in system prompt")
						} else if (groups[idx] == "@cogs_func") {
							throw new Error("@cogs_func not allowed in system prompt")
						} else if (groups[idx] == "@cogs_include") {
							// add file to prompt
							var filePromptPath = path.join(this.basePath, groups[idx+1]);
							var filePrompt = fs.readFileSync(filePromptPath, 'utf-8');
							// normalise whitespace
							filePrompt = filePrompt.replaceAll("\r\n","\n")
							this.system_prompt += filePrompt;
							idx += 1
						} else if (groups[idx] == "@cogs_endfunc") {
							throw new Error("@cogs_endfunc not allowed in system prompt")
						} else { // bare text
							this.system_prompt += groups[idx]
						}
					} else if (mode == "func") {
						if (groups[idx] == "@cogs_system_prompt") {
							throw new Error("@cogs_system_prompt not allowed in function prompt")
						} else if (groups[idx] == "@cogs_func") {
							throw new Error("@cogs_func while already in function prompt")
						} else if (groups[idx] == "@cogs_include") {
							// add file to prompt
							var filePromptPath = path.join(this.basePath, groups[idx+1]);
							var filePrompt = fs.readFileSync(filePromptPath, 'utf-8');
							this.func_prompt += filePrompt;
							idx += 1
						} else if (groups[idx] == "@cogs_endfunc") {
							throw new Error("@cogs_endfunc not allowed inside function prompt")
						} else { // bare text
							this.func_prompt += groups[idx]
						}
					}
					idx += 1
				}
				if (groups.length == 1 && this.func_prompt != "") {
					if (!this.isBuildTarget(this.funcname)) {
						console.log(">> Comment section in AI generated section, but not target -> keep")
						this.newFileContent += section
					} else {
						console.log(">> Comment section without directives while in AI generated section -> removed")
					}
				} else {
					console.log(">> Regular comment section -> copy verbatim")
					this.newFileContent += section
				}
			} else {
				//console.log("Code section")
				//console.log(section)
				if (this.func_prompt == "") {
					console.log(">> Non-AI code section kept.")
					this.newFileContent += section
				} else if (this.isBuildTarget(this.funcname)) {
					this.initNextDiff(section)
					console.log(">> Code section overwritten.")
				} else {
					console.log(">> Old code section kept.")
					this.newFileContent += section
				}
			}
		}
		await this.writeOldFunc(true)
		return {text: this.newFileContent, diffs: this.fileDiffs}
	}
}

module.exports = {UpdateCogsInPlace}
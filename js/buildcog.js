"use strict";

const fs = require('fs')
const path = require('path')
require('colors');

const {diffChars} = require('diff')

const callLLM = require('./call_llm.js')
const {CommentParser} = require('./comment_parser.js') 



class BuildCogTools {
	buildCog // BuildCog instance
	targetIndex // target index in buildfile

	constructor(buildCog,targetIndex) {
		this.buildCog = buildCog
		this.targetIndex = targetIndex
	}

	create_class(args/*,targetBaseDir,manifest,getPromptSpec*/) {
		const target = path.resolve(this.buildCog.targetBaseDir, this.buildCog.manifest.targets[this.targetIndex].file)
		var code = this.buildCog.getPromptSpec(this.targetIndex) + args.source_code
		// Ensure the directory exists
		fs.mkdirSync(path.dirname(target), { recursive: true })
		fs.writeFileSync(target, code, 'utf8')
	}
}

class BuildCog {
	tools = [
		{
			"type": "function",
			"function": {
				"name": "create_class",
				"description": "Create a class. It should be specified in full, do not omit any code.",
				"parameters": {
					"type": "object",
					"properties": {
						"source_code": {
							"type": "string",
							"description": "The source code of the class",
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
	];

	client;
	command;
	buildTargets;
	buildFilePath;
	baseDir;
	targetBaseDir;

	manifest=null;
	prompts=null;

	constructor(client,command,buildTargets,buildFilePath) {
		this.client = client
		this.command = command
		this.buildTargets = buildTargets
		this.buildFilePath = buildFilePath
		this.baseDir = path.dirname(buildFilePath)

		try {
			const data = fs.readFileSync(buildFilePath, 'utf8');
			this.manifest = JSON.parse(data);
		} catch (err) {
			throw new Error(err.message)
		}

		this.targetBaseDir = this.manifest.wd ? path.resolve(this.baseDir, this.manifest.wd) : this.baseDir;

		this.prompts = this.generatePromptsFromManifest(this.manifest, this.baseDir, this.targetBaseDir)
	}


	/**
	 * Given an array of prompts (each with "file" or "text"),
	 * return an array of resolved prompt strings concatenated in order.
	 *
	 * @param {Array} prompts Array of prompt objects
	 * @param {string} baseDir Optional base directory to resolve files from
	 * @returns {string} The full concatenated prompt text
	 */
	assemblePromptText(prompts, baseDir = '.') {
		return prompts.map(prompt => {
			let result = '';
			if (prompt.text) {
			result += prompt.text;
			}
			if (prompt.file) {
				const filePath = path.resolve(baseDir, prompt.file);
				const fileContent = fs.readFileSync(filePath, 'utf8');
				result += fileContent;
			}
			return result;
		}).join('\n');
	}

	/**
	 * For each output in the manifest, assemble the complete prompt text
	 * by combining system_prompts and the output prompts, and resolving their content.
	 *
	 * @param {object} manifest The manifest object
	 * @param {string} baseDir Optional base directory for file resolution
	 * @returns {Array} Array of objects with output type and assembled prompt text
	 */
	generatePromptsFromManifest(manifest, baseDir = '.', targetBaseDir = ".") {
		var user_prompts = manifest.targets.map(target => {
			const promptText = this.assemblePromptText(target.prompts, targetBaseDir);
			return {
				name: target.name,
				text: promptText
			};
		});
		var system_prompt = this.assemblePromptText(manifest.system_prompts, baseDir);
		return {
			system_prompt: system_prompt,
			user_prompts: user_prompts,
		}
	}

	getPromptSpec(i) {
		var commentparser = new CommentParser(this.manifest.targets[i].file)
		var version = require('../package.json').version
		var prompt = `@webcogs_build ${version} openai-${this.getModel()} ${new Date().toISOString()}\n`
				+ "@webcogs_system_prompt\n" + this.prompts.system_prompt
				+ "\n@webcogs_user_prompt\n" + this.prompts.user_prompts[i].text
				+ "\n@webcogs_end_prompt_section"
		// escape comments
		// TODO also escape other comment types via CommentParser
		prompt = prompt.replace(/\/\*/g, '\\/*').replace(/\*\//g, '*\\/');
		prompt = `${commentparser.fileDelim.moduleStart}${prompt}${commentparser.fileDelim.moduleEnd}\n`;
		// normalise linebreaks
		return prompt.replaceAll("\r\n","\n")
	}

	getOldPrompt(target) {
		var commentparser = new CommentParser(target)
		let oldContent = '';
		try {
			oldContent = fs.readFileSync(target, 'utf8');
		} catch (err) {
			console.log(`Cannot read target file "${target}".`.bgRed.white);
			return null;
		}
		const endTag = `@webcogs_end_prompt_section${commentparser.fileDelim.moduleEnd}\n`;
		const endIndex = oldContent.indexOf(endTag);
		if (endIndex !== -1) {
			// include '@webcogs_end_prompt_section' in the extracted string
			const sliceIndex = oldContent.indexOf(endTag) + endTag.length;
			return oldContent.slice(0, sliceIndex).replaceAll("\r\n","\n");
		} else {
			console.log(`Target file "${target} does not have a prompt section.`.bgRed.white);
			return null;
		}
	}

	getModel() {
		return this.manifest.model ? this.manifest.model : "gpt-5"
	}

	remove_build_timestamp(prompt) {
		return prompt.replace(/@webcogs_build.*\n/,"")
	}


	async build(i,updateOnly) {
		if (updateOnly) {
			var new_prompt = this.getPromptSpec(i);
			const target = path.resolve(this.targetBaseDir, this.manifest.targets[i].file);
			var old_prompt = this.getOldPrompt(target)
			new_prompt = this.remove_build_timestamp(new_prompt)
			old_prompt = this.remove_build_timestamp(old_prompt)
			if (new_prompt == old_prompt) {
				console.log(`Skipping ${this.manifest.targets[i].name}, no changes to prompt.`)
				return;
			}
		}
		console.log(`Building ${this.manifest.targets[i].name}...`)
		var ai_functions = new BuildCogTools(this,i)
		var messages = [
			{
				"role": "developer",
				"content": this.prompts.system_prompt,
			},{
				"role": "user",
				"content": this.prompts.user_prompts[i].text+" Do not explain what you have done.",
			}
		]
		var output = await callLLM.callLLM(this.client,messages,this.tools,"aifn_",ai_functions,this.getModel(),2,null,2000)
		//console.log(output)
		//console.log(messages)
	}

	diff(i) {
		var new_prompt = this.getPromptSpec(i);
		const target = path.resolve(this.targetBaseDir, this.manifest.targets[i].file);
		var old_prompt = this.getOldPrompt(target)
		new_prompt = this.remove_build_timestamp(new_prompt)
		old_prompt = this.remove_build_timestamp(old_prompt)
		if (old_prompt === null) {
			// exception already reported
			return;
		}
		if (old_prompt != new_prompt) {
			console.log(`Prompt differs in target file "${target}":`.bgBlue.white);
			const diff = diffChars(old_prompt, new_prompt);
			diff.forEach((part) => {
				// green for additions, red for deletions
				let text = part.added ? part.value.green :
							part.removed ? part.value.red :
											part.value;
				process.stdout.write(text);
			});
			//process.stdout.write("\n")
		} else {
			console.log(`Prompt is unchanged in target file "${target}."`.bgBlue.white);
		}
	}

	// returns false on success or error message
	async runCommand() {
		for (var i=0; i<this.prompts.user_prompts.length; i++) {
			if (!this.buildTargets.includes("all") && !this.buildTargets.includes(this.prompts.user_prompts[i].name)) continue;
			if (this.command == "build") {
				await this.build(i,false)
				return false;
			} else if (this.command == "build-parallel") {
				// unofficial parallel build command until we have something better
				this.build(i,false).then( ((name) => {
					return function() {
						console.log(`Build ${name} finished.`)
					}
				})(this.prompts.user_prompts[i].name))
				return false;
			} else if (this.command == "build-changed") {
				await this.build(i,true)
				return false;
			} else if (this.command == "diff") {
				this.diff(i)
				return false;
			} else {
				console.error(`Unknown command ${this.command}.`)
				return `Unknown command ${this.command}.`
			}
		}
	}
}

module.exports = {BuildCog}
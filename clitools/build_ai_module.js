#!/usr/bin/env node
"use strict";

const fs = require('fs')
const path = require('path')
require('colors');

var OpenAI = require("openai")
const {diffChars} = require('diff')

const callLLM = require('../js/call_llm.js')
const secrets = require("../secrets.js")

/**
 * Given an array of prompts (each with "file" or "text"),
 * return an array of resolved prompt strings concatenated in order.
 *
 * @param {Array} prompts Array of prompt objects
 * @param {string} baseDir Optional base directory to resolve files from
 * @returns {string} The full concatenated prompt text
 */
function assemblePromptText(prompts, baseDir = '.') {
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
function generatePromptsFromManifest(manifest, baseDir = '.', targetBaseDir = ".") {
    var user_prompts = manifest.targets.map(target => {
        const promptText = assemblePromptText(target.prompts, targetBaseDir);
        return {
            name: target.name,
            text: promptText
        };
    });
    var system_prompt = assemblePromptText(manifest.system_prompts, baseDir);
    return {
        system_prompt: system_prompt,
        user_prompts: user_prompts,
    }
}


// -----------------------------------------------------------------------------
// Main build script

if (process.argv.length < 5) {
    console.error('Usage: buildcog  <command>  <build target>  <prompt manifest json file>.  Command is one of: diff, build, build-changed.');
    process.exit(1);
}

const command = process.argv[2]
const buildTarget = process.argv[3];
const manifestPath = process.argv[4];

let manifest;
try {
    const data = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(data);
} catch (err) {
    console.error('Failed to read or parse manifest file:', err.message);
    process.exit(1);
}

var baseDir = "."
const targetBaseDir = manifest.wd ? path.resolve(baseDir, manifest.wd) : baseDir;

var prompts = generatePromptsFromManifest(manifest, baseDir, targetBaseDir)

//console.log(prompts)


var client = new OpenAI.OpenAI({apiKey: secrets.openai_apikey})

const tools = [
	{
		"type": "function",
		"function": {
			"name": "create_plugin",
			"description": "Create a Javascript class for a plugin. It should be specified in full, do not omit any code.",
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

function getPromptSpec(i) {
    var prompt = "/*@webcogs_system_prompt\n" + prompts.system_prompt
            + "\n@webcogs_user_prompt\n" + prompts.user_prompts[i].text
            + "\n@webcogs_end_prompt_section*/\n"
    return prompt.replaceAll("\r\n","\n")
}

function getOldPrompt(target) {
    let oldContent = '';
    try {
        oldContent = fs.readFileSync(target, 'utf8');
    } catch (err) {
        console.log(`Cannot read target file "${target}".`.bgRed);
        return null;
    }
    const endIndex = oldContent.indexOf("@webcogs_end_prompt_section*/\n");
    if (endIndex !== -1) {
        // include '@webcogs_end_prompt_section' in the extracted string
        const endTag = "@webcogs_end_prompt_section*/\n";
        const sliceIndex = oldContent.indexOf(endTag) + endTag.length;
        return oldContent.slice(0, sliceIndex).replaceAll("\r\n","\n");
    } else {
        console.log(`Target file "${target} does not have a prompt section.`.bgRed);
        return null;
    }
}

async function build(i,updateOnly) {
    if (updateOnly) {
        const new_prompt = getPromptSpec(i);
        const target = path.resolve(targetBaseDir, manifest.targets[i].file);
        const old_prompt = getOldPrompt(target)
        if (new_prompt == old_prompt) return;
    }
    function create_plugin(args) {
        const target = path.resolve(targetBaseDir, manifest.targets[i].file);
        var code = getPromptSpec(i) + args.source_code
        fs.writeFileSync(target, code, 'utf8')
    }
    var ai_functions = {
        "create_plugin": create_plugin,
    }
    var messages = [
        {
            "role": "developer",
            "content": prompts.system_prompt,
        },{
            "role": "user",
            "content": prompts.user_prompts[i].text,
        }
    ]
    var output = await callLLM.callLLM(client,messages,tools,"aifn_",ai_functions,manifest.model ? manifest.model : "o3",5,null,2000)
    //console.log(output)
    //console.log(messages)
}

function diff(i) {
    const new_prompt = getPromptSpec(i);
    const target = path.resolve(targetBaseDir, manifest.targets[i].file);
    const old_prompt = getOldPrompt(target)
    if (old_prompt === null) {
        // exception already reported
        return;
    }
    if (old_prompt != new_prompt) {
        console.log(`Prompt differs in target file "${target}":`.bgBlue);
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
        console.log(`Prompt is unchanged in target file "${target}."`.bgBlue);
    }
}

async function runCommand() {
    for (var i=0; i<prompts.user_prompts.length; i++) {
        if (buildTarget != "all" && buildTarget != prompts.user_prompts[i].name) continue;
        if (command == "build") {
            await build(i,false)
        } else if (command == "build-changed") {
            await build(i,true)
        } else if (command == "diff") {
            diff(i)
        } else {
            console.error(`Unknown command ${command}.`);
            process.exit(1);
        }
    }
}

runCommand()

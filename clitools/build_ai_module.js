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
function generatePromptsFromManifest(manifest, baseDir = '.') {
    var user_prompts = manifest.outputs.map(output => {
        //const fullPrompts = [
        //  ...(manifest.system_prompts || []),
        //  ...(output.prompts || [])
        //];
        const promptText = assemblePromptText(output.prompts, baseDir);
        return {
            type: output.type,
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
// manifest contains the following fields:
// name: name of the module
// description: description of the module
// system_prompts: an array of prompt objects. These are read in the order they appear. 
//     Each prompt object has a field "file" which is a path to a prompt file and/or a field "text" which contains literal prompt text.
// outputs: an array of output objects. Each output object has the following format:
//     type: a string representing the type of output (for example, code or test)
//     prompts: an array of prompt objects. These are concatenated to the system_prompts.
//     outfile: file to output the result to

if (process.argv.length < 4) {
    console.error('Usage: node script.js <command> <prompt manifest json file>.  Command is one of: diff, build');
    process.exit(1);
}

const command = process.argv[2]
const manifestPath = process.argv[3];

let manifest;
try {
    const data = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(data);
} catch (err) {
    console.error('Failed to read or parse manifest file:', err.message);
    process.exit(1);
}

var prompts = generatePromptsFromManifest(manifest)

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
    return    "/*@webcogs_system_prompt\n" + prompts.system_prompt
            + "\n@webcogs_user_prompt\n" + prompts.user_prompts[i].text
            + "\n@webcogs_end_prompt_section*/\n"
}

async function build(i) {
    function create_plugin(args) {
        const target = manifest.outputs[i].target
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
    var output = await callLLM.callLLM(client,messages,tools,"aifn_",ai_functions,"o3",5,null,2000)
    //console.log(output)
    //console.log(messages)
}

function diff(i) {
    const new_prompt = getPromptSpec(i);
    const target = manifest.outputs[i].target;

    let oldContent = '';
    try {
        oldContent = fs.readFileSync(target, 'utf8');
    } catch (err) {
        console.log(`Cannot read target file "${target}.`);
        return;
    }
    const endIndex = oldContent.indexOf("@webcogs_end_prompt_section*/\n");
    let old_prompt = '';
    if (endIndex !== -1) {
        // include '@webcogs_end_prompt_section' in the extracted string
        const endTag = "@webcogs_end_prompt_section*/\n";
        const sliceIndex = oldContent.indexOf(endTag) + endTag.length;
        old_prompt = oldContent.slice(0, sliceIndex);
    } else {
        console.log(`Target file "${target} does not have a prompt section.`);
        return;
    }
    if (old_prompt !== new_prompt) {
        console.log(`Prompt differs in target file "${target}":`);
        const diff = diffChars(old_prompt, new_prompt);
        diff.forEach((part) => {
            // green for additions, red for deletions
            let text = part.added ? part.value.bgGreen :
                        part.removed ? part.value.bgRed :
                                        part.value;
            process.stdout.write(text);
        });
    } else {
        console.log(`Prompt is unchanged in target file "${target}."`);
    }
}

async function runCommand() {
    for (var i=0; i<prompts.user_prompts.length; i++) {
        if (command == "build") {
            await build(i)
        } else if (command == "diff") {
            diff(i)
        } else {
            console.error(`Unknown command ${command}`);
            process.exit(1);
        }
    }
}

runCommand()

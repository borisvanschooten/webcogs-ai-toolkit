#!/usr/bin/env node
/* Comment directives recognised by updateinline. These should be inside C-style multiline comments.

@webcogs_system_prompt - Indicate that the rest of this multiline comment is a system prompt that will be fed into all subsequent functions.  

@webcogs_func [functionName] - Tell the AI to create a function here. The rest of the multiline comment will be interpreted as a function prompt. The function will be output right after the multiline comment ends. Code that was there will be removed up to either @webcogs_endfunc or the next @webcogs_func.

@webcogs_include [filename] - include a file here. Can be used inside a system or function prompt.   

@webcogs_endfunc - indicates the end of an AI generated function. This is added automatically after a function was generated.
*/

const fs = require('fs');
const path = require('path');

const OpenAI = require("openai")
const XGettext = require( 'xgettext-js' );
const callLLM = require('../js/call_llm.js');

const secrets = require("../secrets.js")

var client = new OpenAI.OpenAI({apiKey: secrets.openai_apikey})

var gettext_parser = new XGettext({keywords: { "translate": 1 } });

if (process.argv.length < 4) {
    console.error('Usage: updatecogsinplace  [function_names]+  input_file.');
    process.exit(1);
}

var inputFile = process.argv[process.argv.length-1]

var basePath = path.dirname(inputFile);

var buildTargets = process.argv.slice(2,-1)

// AI inputs

function create_function(args) {
    // TODO get version from manifest?
    newFileContent += `\n@webcogs_build 0.2.0 openai-o3 ${new Date().toISOString()}\n`
    newFileContent += args.source_code+"\n"
}
function report_error(args) {
    args.error_message.replaceAll("\r"," ")
    args.error_message.replaceAll("\n"," ")
    // TODO get version from manifest?
    newFileContent += `\n@webcogs_build 0.2.0 openai-o3 ${new Date().toISOString()}\n`
    newFileContent += "//@webcogs_func_error "+args.error_message+"\n"
}
var ai_functions = {
    "create_function": create_function,
    "report_error": report_error,
}

const tools = [
	{
		"type": "function",
		"function": {
			"name": "create_function",
			"description": "Create a Javascript function. It should be specified in full, do not omit any code.",
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

async function writeOldFunc(selfClosing) {
    if (!funcname || !isBuildTarget(funcname)) {
        funcname = null
        func_prompt = ""
        return;
    }
    if (func_prompt != "") {
        // write out previous function
        console.log(`>> Generating ${funcname}...`)
        //console.log(system_prompt)
        //console.log(func_prompt)
        func_prompt = "Create a function named '"+funcname+"' according to the following specifications.  These must specify the function behaviour, parameters, and format of the return value precisely and unambiguously. If the specifications are not clear, call report_error instead of create_function. Do not write function documentation. Only call tools, do not explain what you have done.\n" + func_prompt
        var messages = [
            {
                "role": "developer",
                "content": system_prompt,
            },{
                "role": "user",
                "content": func_prompt,
            }
        ]
        // output is LLM talk, which is ignored
        var output = await callLLM.callLLM(client,messages,tools,"aifn_",ai_functions,"o3",2,null,2000)
        if (selfClosing) {
            console.log(">> Self-closing code section.")
            newFileContent += "/*@webcogs_endfunc*/\n"
        }
        func_prompt = ""
        funcname = null
    }
}


function isBuildTarget(funcname) {
    return buildTargets.includes(funcname) || buildTargets.includes("all")
}


function splitIntoSections(source) {
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


async function parseFile() {
    var fileContent = fs.readFileSync(inputFile, 'utf-8');
    // normalise linebreaks
    fileContent = fileContent.replaceAll("\r\n","\n")

    var sections = splitIntoSections(fileContent)
    system_prompt = ""
    funcname = null
    func_prompt = ""
    for (var i=0; i<sections.length; i++) {
        var section = sections[i].text
        if (sections[i].kind == "comment") {
            sec = section.slice(2, -2) // strip comment symbols
            // capture all commands and parameters in separate groups
            var regex2 = /(@webcogs_system_prompt)|(@webcogs_func)\s+([a-zA-Z0-9_]+)|(@webcogs_include)\s+"([^"]+)"|(@webcogs_endfunc)/g
            var groups = sec.split(regex2)
            // remove empty capture groups which show up as undefined
            groups = groups.filter(element => element !== undefined);
            var mode = "start" // start, system, func
            var idx = 0
            while (idx < groups.length) {
                //console.log("Mode: "+mode)
                //console.log("Next group: #"+groups[idx]+"#")
                if (mode == "start") {
                    if (groups[idx] == "@webcogs_system_prompt") {
                        await writeOldFunc(true)
                        mode = "system"
                    } else if (groups[idx] == "@webcogs_func") {
                        await writeOldFunc(true)
                        funcname = groups[idx+1]
                        idx += 1
                        mode = "func"
                    } else if (groups[idx] == "@webcogs_include") {
                        throw new Error("@webcogs_include must be inside system or function prompt")
                    } else if (groups[idx] == "@webcogs_endfunc") {
                        if (func_prompt != "") {
                            await writeOldFunc(false)
                        } else {
                            throw new Error("@webcogs_endfunc without function prompt")
                        }
                    } else { 
                        // bare text -> ignore
                    }
                } else if (mode == "system") {
                    if (groups[idx] == "@webcogs_system_prompt") {
                        throw new Error("@webcogs_system_prompt while already in system prompt")
                    } else if (groups[idx] == "@webcogs_func") {
                        throw new Error("@webcogs_func not allowed in system prompt")
                    } else if (groups[idx] == "@webcogs_include") {
                        // add file to prompt
                        var filePromptPath = path.join(basePath, groups[idx+1]);
                        var filePrompt = fs.readFileSync(filePromptPath, 'utf-8');
                        // normalise whitespace
                        filePrompt = filePrompt.replaceAll("\r\n","\n")
                        system_prompt += filePrompt;
                        idx += 1
                    } else if (groups[idx] == "@webcogs_endfunc") {
                        throw new Error("@webcogs_endfunc not allowed in system prompt")
                    } else { // bare text
                        system_prompt += groups[idx]
                    }
                } else if (mode == "func") {
                    if (groups[idx] == "@webcogs_system_prompt") {
                        throw new Error("@webcogs_system_prompt not allowed in function prompt")
                    } else if (groups[idx] == "@webcogs_func") {
                        throw new Error("@webcogs_func while already in function prompt")
                    } else if (groups[idx] == "@webcogs_include") {
                        // add file to prompt
                        var filePromptPath = path.join(basePath, groups[idx+1]);
                        var filePrompt = fs.readFileSync(filePromptPath, 'utf-8');
                        func_prompt += filePrompt;
                        idx += 1
                    } else if (groups[idx] == "@webcogs_endfunc") {
                        throw new Error("@webcogs_endfunc not allowed inside function prompt")
                    } else { // bare text
                        func_prompt += groups[idx]
                    }
                }
                idx += 1
            }
            if (groups.length == 1 && func_prompt != "") {
                if (!isBuildTarget(funcname)) {
                    console.log(">> Comment section in AI generated section, but not target -> keep")
                    newFileContent += section
                } else {
                    console.log(">> Comment section without directives while in AI generated section -> removed")
                }
            } else {
                console.log(">> Regular comment section -> copy verbatim")
                newFileContent += section
            }
        } else {
            //console.log("Code section")
            //console.log(section)
            if (func_prompt == "") {
                console.log(">> Non-AI code section kept.")
                newFileContent += section
            } else if (isBuildTarget(funcname)) {
                console.log(">> Code section overwritten.")
            } else {
                newFileContent += section
                console.log(">> Old code section kept.")
            }
        }
    }
    await writeOldFunc(true)
}

var newFileContent = ""


var system_prompt = ""
var funcname = null
var func_prompt = ""

parseFile().then( () => {
    fs.writeFileSync(inputFile+"-generated.js", newFileContent, 'utf-8');
})

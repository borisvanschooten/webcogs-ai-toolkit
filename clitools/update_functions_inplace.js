#!/usr/bin/env node
/* Comment directives recognised by updateinline. These should be inside C-style multiline comments.

@cogs_system_prompt - Indicate that the rest of this multiline comment is a system prompt that will be fed into all subsequent functions.  

@cogs_func [functionName] - Tell the AI to create a function here. The rest of the multiline comment will be interpreted as a function prompt. The function will be output right after the multiline comment ends. Code that was there will be removed up to either @cogs_endfunc or the next @cogs_func.

@cogs_include [filename] - include a file here. Can be used inside a system or function prompt.   

@cogs_endfunc - indicates the end of an AI generated function. This is added automatically after a function was generated.
*/

const fs = require('fs');
const path = require('path');

const OpenAI = require("openai")
const {UpdateCogsInPlace} = require('../js/updatecogsinplace.js');

//const secrets = require("../secrets.js")



if (!process.env.OPENAI_API_KEY) {
    console.error('Error: Environment variable "OPENAI_API_KEY" is not set.');
    process.exit(1);
}

if (process.argv.length < 4) {
    console.error('Usage: updatecogsinplace  [function_names]+  input_file.');
    process.exit(1);
}

var client = new OpenAI.OpenAI({apiKey: process.env.OPENAI_API_KEY})

var inputFile = process.argv[process.argv.length-1]
var basePath = path.dirname(inputFile)

var fileContent = fs.readFileSync(inputFile, 'utf-8');

var parser = new UpdateCogsInPlace(client, fileContent, basePath, process.argv.slice(2,-1), "openai", "o3-mini")

parser.parseFile().then( (update) => {
    fs.writeFileSync(inputFile+"-generated.js", update.text, 'utf-8');
    console.log(update.diffs)
})

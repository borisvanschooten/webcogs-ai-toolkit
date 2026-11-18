#!/usr/bin/env node
"use strict";

const fs = require('fs');
const OpenAI = require("openai")
const XGettext = require( 'xgettext-js' );
const callLLM = require('../js/call_llm.js');

const commandLineArgs = require('command-line-args');
const PO = require("pofile")


function rewriteExportStatements(source) {
	// Replace "export class <class> {" with "class <class> {"
	source = source.replace(/export class (\w+) \{/g, 'class $1 {');
	// Replace "export default class <class> {" with "class <class> {"
	source = source.replace(/export default class (\w+) \{/g, 'class $1 {');
	// Remove "export default <id>;"
	source = source.replace(/export default \w+;\s*/g, '');
	return source;
}


const tools = [
	{
		"type": "function",
		"name": "save_translations",
		"description": "Create translation file with json translations.",
		"parameters": {
			"type": "object",
			"properties": {
				"translations": {
					"type": "string",
					"description": "the JSON string, which is an array of translations",
				},
			},
			"required": [
				"translations"
			],
			"additionalProperties": false
		},
		"strict": true
	},
];


function save_translations(args) {
	var json = args.translations
    if (typeof json == 'string') {
		json = JSON.parse(json)
	}
	for (var i=0; i<json.length; i++) {
		if (overrideTerms[json[i].source]) {
			json[i].translation = overrideTerms[json[i].source]
		}
	}
    if (typeof json != 'string') {
		json = JSON.stringify(json,null,4)
	}
    fs.writeFileSync(options.output, json, 'utf8');
}


const ai_functions = {
	"save_translations": save_translations,
}



async function llmTranslate(json) {
	var prompt = `The following array specifies an array of translation strings.  Please fill in the translation for each source string and call the tool save_translations with the result. Translate into ${options.language}.\n\n`
	if (options.prompt) {
		prompt += " "+options.prompt+" "
	}
	prompt += JSON.stringify(json,null,4)
	var messages = [
		{
			"role": "user",
			"content": prompt,
		}
	]

	if (options.automatic) {
		var output = await callLLM.callLLMResponses(client,messages,tools,"aifn_",ai_functions,"gpt-4o-mini",2,null,2000)
		return output
	} else {
		save_translations({translations: json})
		return null;
	}
}

async function translateFiles(files) {
	var results = []
	for (var i=0; i<files.length; i++) {
		console.log(`Reading ${files[i]}...`)
		try {
			var fileContent = rewriteExportStatements(fs.readFileSync(files[i], 'utf8'));
			var matches = gettext_parser.getMatches(fileContent);
			var result = matches.map(match => ({
				source: match.string,
				translation: ""
			}));
			console.log(`Found ${result.length} strings.`)
			results = results.concat(result)
		} catch (err) {
			console.error(`Error reading file ${files[0]}: ${err.message}`);
		}
	}
	var duplicates = 0;
    var seen = new Set();
    results = results.filter(item => {
        if (seen.has(item.source)) {
			duplicates++;
            return false;
        } else {
            seen.add(item.source);
            return true;
        }
    });
	console.log(`Removed ${duplicates} duplicates. Total number of strings: ${results.length}.`)
	//console.log(results)
	var translated = await llmTranslate(results);
}

// run -------------------------------------------------------

if (!process.env.OPENAI_API_KEY) {
    console.error('Error: Environment variable "OPENAI_API_KEY" is not set.');
    process.exit(1);
}

var client = new OpenAI.OpenAI({apiKey: process.env.OPENAI_API_KEY})

var gettext_parser = new XGettext({keywords: { "translate": 1 } });


// TODO: add function parameter (so you can use a translate function other than core.translate)
// TODO: fill in override before running through automatic translation so that the AI can use them as examples 
const optionDefinitions = [
  { name: 'language', alias: 'l', type: String },
  { name: 'output', alias: 'o', type: String },
  { name: 'sourcefiles', alias: 's', type: String, multiple: true, defaultOption: true },
  { name: 'pofile', alias: 'p', type: String },
  { name: 'override', alias: 'r', type: String },
  { name: 'automatic', alias: 'a', type: Boolean },
  { name: 'prompt', alias: 't', type: String },
]

const options = commandLineArgs(optionDefinitions)


if (!options.language || !options.output || (!options.sourcefiles && !options.pofile)) {
    console.error('Usage: cogstranslate  --language <target_language>  --output <output_file.json>  [--pofile <pofile.po> ]?  [ --sourcefiles  <input_files> ]+ [ --override <manualtranslations.json> ]? [ --automatic ]? [ --prompt <promptstring> ]? ');
    process.exit(1);
}


var overrideTerms = {}

if (options.override) {
	var override = fs.readFileSync(options.override, 'utf8')
	override = JSON.parse(override)
	for (var i=0; i<override.length; i++) {
		var item = override[i]
		if (!item.translation) continue;
		overrideTerms[item.source] = item.translation
	}
}

if (options.sourcefiles) {
	translateFiles(options.sourcefiles)
} else { // pofile
	var poreader = PO.load(options.pofile, function (err, po) {
		var output = []
		if (err) {
			console.log("Error reading PO file:")
			console.log(err)
		} else {
			for (var i=0; i<po.items.length; i++) {
				var item = po.items[i];
				output.push({
					source: item.msgid,
					translation: "",
				})
			}
			llmTranslate(output);
		}
	});
}
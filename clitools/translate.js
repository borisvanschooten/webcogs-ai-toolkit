const fs = require('fs');
const OpenAI = require("openai")
const XGettext = require( 'xgettext-js' );
const callLLM = require('../js/call_llm.js');

const secrets = require("../secrets.js")

var client = new OpenAI.OpenAI({apiKey: secrets.openai_apikey})

var gettext_parser = new XGettext({keywords: { "translate": 1 } });

if (process.argv.length < 5) {
    console.error('Usage: translatecog  target_language  output_file  [ input_files ]+.');
    process.exit(1);
}

var target_language = process.argv[2];

var output_file = process.argv[3];


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
		"function": {
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
		}
	},
];


function save_translations(args) {
	var json = args.translations
    if (typeof json != 'string') {
		json = JSON.stringify(json,null,4)
	}
    fs.writeFileSync(output_file, json, 'utf8');
}


const ai_functions = {
	"save_translations": save_translations,
}



async function llmTranslate(json) {
	var prompt = `The following array specifies an array of translation strings.  Please fill in the translation for each source string and call the tool save_translations with the result. Translate into ${target_language}.\n\n`
	prompt += JSON.stringify(json,null,4)
	var messages = [
		{
			"role": "user",
			"content": prompt,
		}
	]

	var output = await callLLM.callLLM(client,messages,tools,"aifn_",ai_functions,"gpt-4o-mini",2,null,2000)
	
	return output;
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

translateFiles(process.argv.slice(4))

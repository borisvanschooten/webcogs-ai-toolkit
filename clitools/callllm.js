#!/usr/bin/env node
"use strict";

const OpenAI = require("openai")
const callLLM = require('../js/call_llm.js');

const fs = require('fs');
const commandLineArgs = require('command-line-args');

const optionDefinitions = [
  { name: 'model', alias: 'm', type: String },
  { name: 'prompt', alias: 'p', type: String },
]

const options = commandLineArgs(optionDefinitions)

let prompt = ""
// check for stdin input
const stat = fs.fstatSync(0)
if (stat.isFIFO() /*piped*/ || stat.isFile() || stat.isSocket()) {
	prompt += fs.readFileSync(0, 'utf-8');
}


if (options.prompt) {
	prompt = options.prompt+" "+prompt
}

var model = "gpt-6.1-sol"
if (options.model) model = options.model


var messages = [
	{
		"role": "user",
		"content": prompt,
	}
]

var client = new OpenAI.OpenAI({apiKey: process.env.OPENAI_API_KEY})

callLLM.callLLMResponses(client,messages,[],"aifn_",[],model,2,null,2000)
.then((output) => {
	console.log(output)
})

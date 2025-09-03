#!/usr/bin/env node
"use strict";

var OpenAI = require("openai")
const {BuildCog} = require('../js/buildcog.js');


// -----------------------------------------------------------------------------
// Main build script

if (!process.env.OPENAI_API_KEY) {
    console.error('Error: Environment variable "OPENAI_API_KEY" is not set.');
    process.exit(1);
}


if (process.argv.length < 5) {
    console.error('Usage: buildcog  <command>  <build targets>  <prompt manifest json file>.\n    Command is one of: diff, build, build-changed.\n    Build targets is a list of targets or "all" for all targets.');
    process.exit(1);
}


var client = new OpenAI.OpenAI({apiKey: process.env.OPENAI_API_KEY})

const command = process.argv[2]
const buildTargets = process.argv.slice(3, process.argv.length - 1);
const manifestPath = process.argv[process.argv.length - 1];


try {
    var buildcog = new BuildCog(client,command,buildTargets,manifestPath)
    var err = buildcog.runCommand()
} catch (error) {
    console.error('Failed to read or parse manifest file:', err.message);
    process.exit(1);
}

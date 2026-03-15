#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {UpdateCogsInPlace} = require('../js/updatecogsinplace.js');


if (process.argv.length != 4) {
    console.error('Usage: expandcogs <input_file> <output_file>.');
    process.exit(1);
}

var inputFile = process.argv[2]
var basePath = path.dirname(inputFile)
var outputFile = process.argv[3]

var fileContent = fs.readFileSync(inputFile, 'utf-8');

var parser = new UpdateCogsInPlace(/*client*/null, fileContent, basePath, process.argv.slice(2,-1), "openai", "o3-mini")

parser.parseFile("none").then( (update) => {
    fs.writeFileSync(outputFile, update.cleanedFile, 'utf-8');
})

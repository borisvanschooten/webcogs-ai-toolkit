class CommentParser {
	fileTypes = {
		"js": {
			"singleline": "//",
			"multilineStart": "/*",
			"multilineEnd": "*/",
			"moduleStart": "/*", // = module prompt start
			"moduleEnd": "*/", // = module prompt end
		},
		"php": {
			"singleline": "//",
			"multilineStart": "/*",
			"multilineEnd": "*/",
			"moduleStart": "<?php /*",
			"moduleEnd": "*/?>", // exit php mode so we get to the original state
		},
	};
	fileType;
	fileDelim;
	constructor(filename) {
        this.fileType = filename.split('.').pop();
		if (typeof this.fileTypes[this.fileType] != "undefined") {
			this.fileDelim = this.fileTypes[this.fileType]
		} else {
			// default to JS
			this.fileDelim = fileTypes["js"]
		}
	}
}

module.exports = { CommentParser }

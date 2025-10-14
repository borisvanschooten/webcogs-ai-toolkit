"use strict";


const sqlite = require('node:sqlite');

class SQLiteBridge {
	dbFilePath
	db
	queryCache

	constructor(dbFilePath) {
		this.dbFilePath = dbFilePath
		this.db = new sqlite.DatabaseSync(dbFilePath)
		this.queryCache = {}
	}
	// execute one or more statements without results
	exec(queryString) {
		return this.db.exec(queryString)
	}
	// execute query with optional parameters. 
	// Cannot execute multiple statements, use exec instead
	query(queryString,...params) {
		var query = this.queryCache[queryString]
		if (!query) {
			query = this.db.prepare(queryString)
			this.queryCache[queryString] = query
		}
		return query.all(...params)
	}
}

module.exports = {SQLiteBridge}
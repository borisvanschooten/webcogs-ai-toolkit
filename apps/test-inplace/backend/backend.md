# How to create a backend function

Backend functions are plain Javascript functions that always take a core API handle as the first parameter. The core API has a property "db" that is a SQLite compatible database handle, which has the following functions: 

- async function db.run(sql_statement, optional_values) - execute a SQL statement or query. 
Note this is an async function. If it is a query, returns an array of objects, otherwise returns null. Each object represents a record, with keys representing the column names and values the record values. If optional_values is supplied, it should be an array, with its elements bound to "?" symbols in the sql_statement string. For example: db.run("SELECT * FROM my_table WHERE id=?",[1000]) will be interpolated to "SELECT * FROM my_table where id=1000". 

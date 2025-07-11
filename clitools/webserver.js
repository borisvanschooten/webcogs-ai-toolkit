const express = require('express');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

// initialised asynchronously by initDB
var db = null;

async function initDB() {
	const SQL = await initSqlJs({});

	db = new SQL.Database();
	var sqlstr = fs.readFileSync("apps/webcogs-example-app/datamodel.sql", "utf8");
	db.run(sqlstr);
	sqlstr = 'CREATE TABLE Passwords (\
		username TEXT NOT NULL,\
		password TEXT NOT NULL\
	);\
  INSERT INTO Passwords VALUES ("admin","admin")\
  '
	db.run(sqlstr);

	sqlstr = 
  'INSERT INTO user VALUES (1,"johnny","johnsmith@gmail.com","John","Smith","1998-05-06");\
	INSERT INTO user VALUES (2,"alan","alansmithee@gmail.com","Alan","Smithee","1978-10-01");\
  INSERT INTO Ticket VALUES (1,1,"Hi, I have a problem with my phone.  Internet has stopped working.","2025-07-01",NULL,NULL);\
	INSERT INTO Ticket VALUES (2,1,"The problem with my phone persists, please help.","2025-07-07",NULL,NULL);\
	INSERT INTO Ticket VALUES (3,2,"Hi there, my Outlook is flagging important mail as spam. What can I do about this?","2025-07-03",NULL,NULL);\
	'
	db.run(sqlstr);

	const res = db.exec("SELECT * FROM User");
	//console.log(JSON.stringify(res,null,4))
}

var tokenStore = {}

initDB()

const app = express();
const port = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain'
};

app.get('/db/run', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not initialized' });
  }
  const query = req.query.query;
  const token = req.query.token;
  if (!query || !token) {
    return res.status(400).json({ error: 'Query and token nust be provided' });
  }
  if (!Object.values(tokenStore).includes(token)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  try {
    const result = db.exec(query);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});




app.get('/auth/login', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not initialized' });
  }

  const { username, password } = req.query;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password must be provided' });
  }

  try {
    const result = db.exec(`SELECT * FROM Passwords WHERE username = '${username}' AND password = '${password}'`);
    if (result.length > 0) {
      const token = require('crypto').randomBytes(32).toString('hex');
      tokenStore[`${username}#${password}`] = token;
      return res.json({ token });
    } else {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res, next) => {
  const filePath = path.join(process.cwd(), decodeURIComponent(req.path));
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = mimeTypes[ext];
      if (mime) {
        res.type(mime);
      }
    }
    next();
  });
});
app.use(express.static(process.cwd()));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const commandLineArgs = require('command-line-args');


const optionDefinitions = [
    { name: 'datafile', alias: 'f', type: String },
    { name: 'purge', alias: 'p', type: Boolean }, // not implemented yet, just delete the file
    { name: 'sqlfiles', alias: 's', type: String, multiple: true},
    { name: 'credentialssql', alias: 'c', type: String, multiple: true},
]

const options = commandLineArgs(optionDefinitions)


// DB handle, possibly initialised asynchronously
var db = null;


// OLD db code -----------------------------------------
const initSqlJs = require('sql.js');


async function initDB() {
    const SQL = await initSqlJs({});

    db = new SQL.Database();
    var sqlstr = fs.readFileSync("apps/webcogs-example-app/sql/datamodel.sql", "utf8");
    db.run(sqlstr);
    sqlstr = 'CREATE TABLE Passwords IF NOT EXISTS (\
        username TEXT NOT NULL,\
        password TEXT NOT NULL\
    );\
    INSERT INTO Passwords VALUES ("alan","admin");\
    INSERT INTO Passwords VALUES ("johnny","admin");\
    INSERT INTO Passwords VALUES ("wendy","admin");\
    '
    db.run(sqlstr);

    sqlstr = 
    'INSERT INTO Organization VALUES (1,"Organization 1","vendor");\
    INSERT INTO Organization VALUES (2,"Organization 2","vendor");\
    INSERT INTO Organization VALUES (3,"Organization 3","vendor");\
    INSERT INTO user VALUES (1,"johnny","johnsmith@gmail.com","John","Smith",1,"user");\
    INSERT INTO user VALUES (2,"alan","alansmithee@gmail.com","Alan","Smithee",2,"developer");\
    INSERT INTO user VALUES (3,"wendy","wendy-potters@gmail.com","Wendy","Potters",3,"user");\
    INSERT INTO Ticket VALUES (1,1,2,"Hi, I have a problem with my phone.  Internet has stopped working.","2025-07-01 11:10:00","open");\
    INSERT INTO Ticket VALUES (2,1,2,"The problem with my phone persists, please help.","2025-07-07 15:30:11","open");\
    INSERT INTO Ticket VALUES (3,2,NULL,"Hi there, my Outlook is flagging important mail as spam. What can I do about this?","2025-07-03 13:33:00","open");\
    INSERT INTO Ticket VALUES (4,3,NULL,"My PC is sometimes very slow and gets very hot.","2025-07-03 14:12:56","open");\
    '
    db.run(sqlstr);

    const res = db.exec("SELECT * FROM User");
    //console.log(JSON.stringify(res,null,4))
}

//initDB()

// NEW db code -------------------------------------------------


const {SQLiteBridge} = require('../js/sqlitebridge.js')


function readSQLFiles(db,sqlfiles) {
  if (sqlfiles) {
      for (var i=0; i<sqlfiles.length; i++) {
          var filename = sqlfiles[i]
          console.log(`Executing ${filename}...`)
          var sqlstr = fs.readFileSync(filename, "utf8");
          result = db.exec(sqlstr);
          if (result) console.log(result)
      }
  }
}

var datafile = "databases/webcogs-example-app";
if (options.datafile) {
    datafile = options.datafile;
}

db = new SQLiteBridge(`${datafile}.db`);

readSQLFiles(db,options.sqlfiles)

//console.log(db.query("SELECT * FROM User"))

credentialsdb = new SQLiteBridge(`${datafile}-credentials.db`);

sqlstr = 'CREATE TABLE IF NOT EXISTS Passwords (\
    username TEXT NOT NULL,\
    password TEXT NOT NULL\
);'
credentialsdb.exec(sqlstr)

readSQLFiles(credentialsdb,options.credentialssql)



const app = express();
app.use(cookieParser());
const port = 3000;

// XXX in a real application this should be stored in a separate place
const JWT_SECRET = "dummy_secret"

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
  const jwtToken = req.cookies.webcogs_app_access_token;
  const doubleSubmitToken = req.cookies.webcogs_app_csrf_token;
  var jwtPayload = null;
  try {
    jwtPayload = jwt.verify(jwtToken, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid JWT Token' });
  }
  var params = [];
  if (typeof req.query.params != "undefined") {
    params = JSON.parse(req.query.params);
    //console.log("Got params: "+req.query.params)
    //console.log(params)
  }
  if (!query || !token || !doubleSubmitToken || !jwtToken) {
    return res.status(400).json({ error: 'Query and token nust be provided' });
  }
  if (jwtPayload.csrf_token != token) {
    return res.status(401).json({ error: 'Invalid access token' });
  }
  // TODO check jwtPayload.timestamp expiry
  try {
    const result = db.query(query,...params);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


app.get('/api/getOrganizations', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not initialized' });
  }
  try {
    const result = db.query("SELECT id, name, role FROM Organization ORDER BY name");
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



app.get('/auth/login', async (req, res) => {
  if (!credentialsdb) {
    return res.status(503).json({ error: 'Database not initialized' });
  }

  const { username, password } = req.query;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password must be provided' });
  }

  try {
    const result = credentialsdb.query(`SELECT * FROM Passwords WHERE Passwords.username = ? AND password = ?`, username, password);
    if (result.length > 0) {
      const doubleSubmitToken = require('crypto').randomBytes(32).toString('hex');
      const userinfo = db.query("SELECT id,role FROM User WHERE username = ?",username)

      var user_id=null,user_role=null
      if (userinfo.length > 0) {
        user_id = userinfo[0].id;
        user_role = userinfo[0].role;
      }
      const payload = {
        user_id: user_id,
        username: username,
        csrf_token: doubleSubmitToken,
        timestamp: Date.now(),
      };
      const jwtToken = jwt.sign(payload, JWT_SECRET);
      res.cookie('webcogs_app_access_token', jwtToken, {
        httpOnly: true,
        secure: true,       // HTTPS only
        sameSite: 'Lax',    // or 'Strict'
        path: '/db/run',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });
      res.cookie('webcogs_app_csrf_token', doubleSubmitToken, {
        secure: true,       // HTTPS only
        sameSite: 'Lax',    // or 'Strict'
        path: '/',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
      });
      return res.json({
         user_id: user_id,
         user_role: user_role,
      });
    } else {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/auth/logout', async (req, res) => {
  res.clearCookie('webcogs_app_access_token', {
    path: '/db/run',
  })
  res.clearCookie('webcogs_app_csrf_token',{
    path: '/',
  })
  return res.json( { result: "Success"} )
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

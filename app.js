const express = require('express')
const session = require('express-session')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https');

const app = express()

// Middleware
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({
  secret: 'geheimnis123',
  resave: false,
  saveUninitialized: true
}))

//Access to rooms.html via own route with verification
app.get('/rooms', (req, res) => {
  const reason = isBanned(req);
  if (reason) {
  return res.send(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gesperrt</title>
      <style>
        body {
          font-family: sans-serif;
          padding: 1rem;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <p>${reason}</p>
    </body>
    </html>
  `);
   }

  if (!req.session.geschlecht) {
    return res.redirect('/index.html')
  }
  const usersPath = path.join(__dirname, 'admins.json');
  if (!fs.existsSync(usersPath)) {
    return res.status(500).send('Admin not found.');
  }

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

  const isAdmin = users.find(user => user.benutzername === req.session.username);

  if (isAdmin) {
  	res.sendFile(path.join(__dirname, 'views', 'roomsadmin.html'))
  }
  else {
  	res.sendFile(path.join(__dirname, 'views', 'rooms.html'))
  }
})

//Route for AJAX request in rooms.html
app.get('/geschlecht', (req, res) => {
  res.json({ geschlecht: req.session.geschlecht || null })
})

app.get('/icons/:name', (req, res) => {
  const name = req.params.name;
  const filePath = path.join(__dirname, 'views', 'roomtypes', 'icons', `${name}`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Icon nicht gefunden');
  }

  res.sendFile(filePath);
});

app.get('/name', (req, res) => {
  res.json({ name: req.session.username || null })
})

app.get('/upload-page', (req, res) => {
	const room = req.query.room;
	const reason = isBanned(req);
    if (reason) {
    	return res.send(`<p>${reason}</p>`);
    }
    let gender;
    if (req.session.geschlecht == "weiblich") {
    	gender = "w";
    }
    else {
    	gender = "m";
    }
    if (room == 1) {
    	const requestsPath = path.join(__dirname, 'views', 'roomtypes');
        const filePath = path.join(requestsPath, "user.html");
        fs.readFile(filePath, 'utf8', (err, html) => {
            if (err) {
                return res.status(500).send('Fehler beim Laden der Seite');
            }
            const bearbeitetesHTML = html
                              .replace('{{ROOM}}', 'Videochatroom')
                              .replace('{{USER}}', req.session.username)
                              .replace('{{GENDER}}', gender);
            res.send(bearbeitetesHTML);
        });
    }
});

//POST receipt of the form
app.post('/login', (req, res) => {
  const { benutzername, alter, geschlecht } = req.body

  if (!benutzername || !alter || !geschlecht) {
    return res.status(400).send('Fehlende Angaben')
  }

  req.session.geschlecht = geschlecht
  req.session.username = benutzername
  res.redirect('/rooms') //Attention: new route!
})

app.post('/loginreg', (req, res) => {
  const { benutzername, password } = req.body

  if (!benutzername || !password) {
    return res.status(400).json({ fehler: 'Benutzername und Passwort erforderlich.' })
  }

  const usersPath = path.join(__dirname, 'admins.json')

  if (!fs.existsSync(usersPath)) {
      return res.status(500).json({ fehler: 'userNotFound' })
  }

  const data = fs.readFileSync(usersPath, 'utf8')
  let users = []

  try {
    users = JSON.parse(data)
  } catch (err) {
    return res.status(500).json({ fehler: 'Benutzerdaten beschädigt.' })
  }

  // Nutzer suchen
  const nutzer = users.find(user => user.benutzername === benutzername)

  if (!nutzer) {
      return res.status(404).json({ fehler: 'userNotFound' })
  }
  
  if (nutzer.password !== password) {
      return res.status(401).json({ fehler: 'wrongPassword' })
  }
  
  const rawIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let ip = rawIP.replace(/^.*:/, '');
  if (ip === '1' || ip === '::1') ip = '127.0.0.1';

  // IP speichern
  nutzer.lastIP = ip;

  // Datei aktualisieren
  try {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    return res.status(500).json({ fehler: 'Fehler beim Speichern der IP.' });
  }

  // Session setzen
  req.session.geschlecht = nutzer.geschlecht
  req.session.username = benutzername
  req.session.registered = true

  res.json({ erfolg: true })
})

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Fehler beim Logout.')
    }
    res.redirect('/index.html')
  })
})

const server = https.createServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}, app);
require('./webrtc')(server)

server.listen(8888, '0.0.0.0', () => {
  console.log('Servidor web iniciado en todas las interfaces')
})

function isBanned(req) {
  const rawIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let ip = rawIP.replace(/^::ffff:/, '');
  if (ip === '::1') ip = '127.0.0.1';

  const bansPath = path.join(__dirname, 'bans.json');

  if (!fs.existsSync(bansPath)) return "";

  try {
    const bans = JSON.parse(fs.readFileSync(bansPath, 'utf8'));
    const eintrag = bans.find(entry => entry.ip === ip);
    if (eintrag) {
    	const translationsPath = path.join(__dirname, 'public', 'translations.json');
        let translations = {};

        try {
            translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
        } catch (err) {
            return res.status(500).send('<p>Fehler beim Laden der Übersetzungen</p>');
        }
      
        const acceptLang = req.headers["accept-language"] || "en";
        const sprache = acceptLang.startsWith("de") ? "de" :
                                      acceptLang.startsWith("es") ? "es" : "en";

        const text = translations[sprache]?.ban || 'Fehler';
        return text.replace('{{REASON}}', eintrag.grund);
    }
    else {
    	return "";
    }
  } catch (err) {
    console.error('Fehler beim Lesen der Ban-Datei:', err);
    return "";
  }
}
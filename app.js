const express = require('express')
const session = require('express-session')
const path = require('path')
const fs = require('fs')
const multer = require('multer');

const storage = multer.diskStorage({
  destination: 'verifications/requests/',
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

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

// Zugriff auf rooms.html über eigene Route mit Prüfung
app.get('/rooms', (req, res) => {
  if (!req.session.geschlecht) {
    return res.redirect('/index.html')
  }
  const usersPath = path.join(__dirname, 'users.json');
  if (!fs.existsSync(usersPath)) {
    return res.status(500).send('Benutzerdaten nicht gefunden.');
  }

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

  const aktuellerBenutzer = users.find(user => user.benutzername === req.session.username);

  const istAdmin = aktuellerBenutzer && aktuellerBenutzer.admin === true;

  if (istAdmin) {
  	res.sendFile(path.join(__dirname, 'views', 'roomsadmin.html'))
  }
  else {
  	res.sendFile(path.join(__dirname, 'views', 'rooms.html'))
  }
})

// Route für AJAX-Anfrage in rooms.html
app.get('/geschlecht', (req, res) => {
  res.json({ geschlecht: req.session.geschlecht || null })
})

app.get('/registered', (req, res) => {
  res.json({ registered: req.session.registered || null })
})

app.get('/name', (req, res) => {
  res.json({ name: req.session.username || null })
})

app.get('/upload-page', (req, res) => {
  if (dateiExistiertOhneEndung('verifications/requests', req.session.username)) {
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

      const text = translations[sprache]?.info4 || 'Fehler';

      res.send(`<p>${text}</p>`);
  }
  else if (dateiExistiertOhneEndung('verifications/reasons', req.session.username)) {
  	
  }
  else {
  	const filePath = path.join(__dirname, 'templates', 'audio.html');

      fs.readFile(filePath, 'utf8', (err, html) => {
          if (err) {
              return res.status(500).send('Fehler beim Laden der Seite');
          }

      // Platzhalter ersetzen (z. B. Benutzername aus Session)
      
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

      const text = translations[sprache]?.info1 || 'Fehler';
      
      const benutzername = req.session.username;
      const bearbeitetesHTML = html
        .replace('{{INFO}}', text)
        .replace('{{USER}}', benutzername + '.webm');
      res.send(bearbeitetesHTML);
      });
  }
});

// POST-Empfang vom Formular
app.post('/login', (req, res) => {
  const { benutzername, alter, geschlecht } = req.body

  if (!benutzername || !alter || !geschlecht) {
    return res.status(400).send('Fehlende Angaben')
  }

  req.session.geschlecht = geschlecht
  res.redirect('/rooms') // Achtung: neue Route!
})

app.post('/loginreg', (req, res) => {
  const { benutzername, password } = req.body

  if (!benutzername || !password) {
    return res.status(400).json({ fehler: 'Benutzername und Passwort erforderlich.' })
  }

  const usersPath = path.join(__dirname, 'users.json')

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

app.post('/register', (req, res) => {
  const { benutzername, alter, geschlecht, password } = req.body

  if (!benutzername || !alter || !geschlecht || !password) {
    return res.status(400).json({ fehler: 'Alle Felder sind erforderlich.' })
  }

  const usersPath = path.join(__dirname, 'users.json')

  // Datei einlesen oder leeres Array erzeugen
  let users = []
  if (fs.existsSync(usersPath)) {
    const data = fs.readFileSync(usersPath, 'utf8')
    try {
      users = JSON.parse(data)
    } catch (err) {
      return res.status(500).send('Benutzerdaten beschädigt.')
    }
  }

  // Prüfen ob Benutzername schon existiert
  const existiert = users.some(user => user.benutzername === benutzername)
  if (existiert) {
  return res.status(409).json({ fehler: 'userExists' })
}

  // Benutzer speichern
  const neuerUser = {
  benutzername,
  alter,
  geschlecht,
  password
}

if (geschlecht === 'weiblich') {
  neuerUser.verified = false
}

users.push(neuerUser)

  try {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8')
  } catch (err) {
    return res.status(500).json({ fehler: 'Fehler beim Speichern.' })
  }

  // Optional: Session setzen, wenn du willst, dass der User gleich eingeloggt ist
  req.session.geschlecht = geschlecht
  req.session.registered = true
  req.session.username = benutzername
  res.json({ erfolg: true })
})

app.post('/request', upload.single('audio'), (req, res) => {
  console.log('Datei empfangen:', req.file);
  res.sendStatus(200);
});

//Admin requests
app.post('/get-request-names', (req, res) => {
  const ordnerPfad = path.join(__dirname, 'verifications', 'requests');

  fs.readdir(ordnerPfad, (err, dateien) => {
    if (err) {
      return res.status(500).json({ fehler: 'Ordner konnte nicht gelesen werden.' });
    }

    // Nur Dateinamen ohne Erweiterung zurückgeben
    const namenOhneEndung = dateien.map(datei => path.parse(datei).name);

    res.json({ namen: namenOhneEndung });
  });
});

app.listen(8888, () => {
  console.log('Servidor web iniciado')
})

function dateiExistiertOhneEndung(ordner, benutzername) {
  const files = fs.existsSync(ordner) ? fs.readdirSync(ordner) : [];

  return files.some(file => path.parse(file).name === benutzername);
}
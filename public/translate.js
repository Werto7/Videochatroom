let translations = {};

function getUserLang() {
  const lang = navigator.language || navigator.userLanguage;
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}

function translatePage(lang) {
  const texts = translations[lang];
  if (!texts) return;

  for (const key in texts) {
    const el = document.getElementById(key);
    if (el) {
      if ('placeholder' in el) {
        el.placeholder = texts[key]; // für Input-Felder
      } else {
        el.textContent = texts[key]; // für normale Texte
      }
    }
  }

  document.documentElement.lang = lang;
}

function getTranslation(key) {
  const lang = getUserLang();
  if (translations[lang] && translations[lang][key]) {
    return translations[lang][key];
  }
  return null;
}

fetch('translations.json')
  .then(response => response.json())
  .then(data => {
    translations = data;
    const userLang = getUserLang();
    translatePage(userLang);
  })
  .catch(error => console.error('Fehler beim Laden der Übersetzungen:', error));
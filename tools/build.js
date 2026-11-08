// Baut aus der Spieldatei (Artifact-Format) die installierbare Web-App.
// Aufruf: node build.js <spiel.html> <ausgabe-ordner>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = path.resolve(process.argv[2] || '../../schuerfland.html');
const OUT = path.resolve(process.argv[3] || path.join(__dirname, '..'));
const HERE = __dirname;

const game = fs.readFileSync(SRC, 'utf8');
const hash = crypto.createHash('sha1').update(game).digest('hex').slice(0, 8);
const gameVer = (game.match(/VERSION\s*=\s*['"]([^'"]+)['"]/) || game.match(/Version\s+(\d+\.\d+(?:\.\d+)?)/) || [])[1] || '?';
const VERSION = gameVer + '-' + hash;

// Kopfteil des Fragments (title, meta, link, style) abtrennen
const headRe = /^(\s*(?:<title>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->)\s*)+/;
const m = game.match(headRe);
if (!m) throw new Error('Kopfteil nicht gefunden');
let head = m[0];
let body = game.slice(m[0].length);
// Google-Schriften durch lokale Kopien ersetzen (offline-fähig)
head = head.replace(/<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g, '');
if (/fonts\.(googleapis|gstatic)\.com/.test(head + body)) console.warn('Hinweis: weitere Google-Fonts-Verweise gefunden');
const title = (head.match(/<title>([\s\S]*?)<\/title>/) || [, 'Schürfland'])[1];
head = head.replace(/<title>[\s\S]*?<\/title>\s*/, '');

// Schriften: Nunito ist eine variable Schrift, eine Datei je Zeichensatz reicht
// Nur die eigenen App-Dateien ersetzen, nie den ganzen Ordner löschen (er kann das Repository sein)
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'fonts.css']) fs.rmSync(path.join(OUT, f), { force: true });
for (const d of ['fonts', 'icons']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
let fontsCss = fs.readFileSync(path.join(HERE, 'fonts.css'), 'utf8')
  .replace(/Nunito-(800|900)-/g, 'Nunito-700-');
const fontFiles = [...new Set([...fontsCss.matchAll(/url\((fonts\/[^)]+)\)/g)].map(x => x[1]))];
for (const f of fontFiles) fs.copyFileSync(path.join(HERE, f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'fonts.css'), fontsCss);
const icons = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png'];
for (const i of icons) fs.copyFileSync(path.join(HERE, 'icons', i), path.join(OUT, 'icons', i));

const manifest = {
  name: 'Schürfland', short_name: 'Schürfland', lang: 'de',
  description: 'Sammel- und Aufbauspiel: Rohstoffe abbauen, Dorf ausbauen, Produktion automatisieren.',
  start_url: './', scope: './', id: './', display: 'standalone', orientation: 'portrait',
  background_color: '#2f9cc4', theme_color: '#2f9cc4',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

const assets = ['./', './index.html', './fonts.css', './manifest.webmanifest', ...fontFiles.map(f => './' + f), ...icons.map(i => './icons/' + i)];
fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync(path.join(HERE, 'sw.js'), 'utf8')
  .replace('__VERSION__', VERSION).replace('__ASSETS__', JSON.stringify(assets)));

// Gleiches Grundgerüst wie im Artifact-Viewer, damit das Spiel genauso aussieht
const shellCss = `:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box}
body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
#sfl-install{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:9999;display:flex;gap:10px;align-items:center;
  background:#fff8e8;color:#23301f;border-radius:16px;padding:12px 12px 12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.3);font:700 15px/1.3 Nunito,system-ui,sans-serif}
#sfl-install b{font-weight:900}
#sfl-install button{flex:none;min-width:44px;min-height:44px;border:0;border-radius:12px;background:#e2902b;color:#fff;font:900 15px Nunito,system-ui,sans-serif;cursor:pointer}`;

const appScript = `<script>
window.SFL_APP = { version: ${JSON.stringify(VERSION)}, standalone: (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true };
</script>`;

const tailScript = `<script>
(function () {
  // Hintergrund des Rahmens an das Spiel anpassen (sichtbar hinter der Statusleiste)
  try { document.documentElement.style.background = getComputedStyle(document.body).backgroundColor; } catch (e) {}
  // Offline-Speicher
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });
  }
  // Hinweis zum Installieren auf dem iPhone (nur im Safari-Browser, nicht in der installierten App)
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  var seen = false; try { seen = localStorage.getItem('sfl-install-hint') === '1'; } catch (e) {}
  if (ios && !window.SFL_APP.standalone && !seen) {
    setTimeout(function () {
      var d = document.createElement('div'); d.id = 'sfl-install';
      d.innerHTML = '<span>Als App installieren: unten auf <b>Teilen</b> tippen, dann <b>Zum Home-Bildschirm</b>.</span><button type="button" aria-label="Hinweis schließen">OK</button>';
      d.querySelector('button').onclick = function () { d.remove(); try { localStorage.setItem('sfl-install-hint', '1'); } catch (e) {} };
      document.body.appendChild(d);
    }, 1500);
  }
})();
</script>`;

// App-Hinweis vor das erste Spiel-Script setzen
const firstScript = body.indexOf('<script');
if (firstScript < 0) throw new Error('Kein Script im Spiel gefunden');
body = body.slice(0, firstScript) + appScript + '\n' + body.slice(firstScript);

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>${title}</title>
<meta name="description" content="${manifest.description}">
<meta name="theme-color" content="#2f9cc4">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Schürfland">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="stylesheet" href="fonts.css">
<style>
${shellCss}
</style>
${head.trim()}
</head>
<body>
${body.trim()}
${tailScript}
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
if (!fs.existsSync(path.join(OUT, 'README.md'))) fs.writeFileSync(path.join(OUT, 'README.md'), `# Schürfland als App

Installierbare Web-App von Schürfland (Version ${VERSION}).

**Installieren auf dem iPhone:** Seite in Safari öffnen, unten auf *Teilen* tippen, dann *Zum Home-Bildschirm*.
**Android (Chrome):** Menü ⋮ → *App installieren*.

Die App läuft offline, im Vollbild und speichert den Spielstand auf dem Gerät.
`);
console.log('App gebaut:', OUT, 'Version', VERSION, '| Dateien:', assets.length);

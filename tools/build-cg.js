// Baut aus der Spieldatei (Artifact-Format) den CrazyGames-Build: Ordner dist-cg/ und schuerfland-cg-<version>.zip.
// Aufruf: node build-cg.js <spiel.html> [ausgabe-ordner] [zip-ordner]
//   Standard: ausgabe-ordner = ./dist-cg neben diesem Skript, zip-ordner = Elternordner der Ausgabe.
// Inhalt: index.html (Lader + DOM des Spiels), game.js (Spiel-Script unverändert bis auf leere Ranglisten-/App-Adressen), fonts.css, fonts/*.woff2.
// Nicht enthalten: Service Worker, Manifest, window.SFL_APP, Installations-Hinweis, Google Fonts, absolute Pfade.
// Lader: SDK v3 laden → await SDK.init() (höchstens 3 s) → bei env 'local'/'crazygames' loadingStart() → window.SFL_CG = { sdk, env },
//   window.SFL_LOCALE = systemInfo.locale → game.js nachladen. Schlägt init fehl, läuft es zu lange oder ist env 'disabled', startet das Spiel trotzdem (SFL_CG.sdk = null).
// Schriften und fonts.css liegen neben diesem Skript (gleich wie in tools/ für build.js; Nunito ist variabel, eine Datei je Zeichensatz).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const SRC = path.resolve(process.argv[2] || path.join(HERE, '..', 'schuerfland.html'));
const OUT = path.resolve(process.argv[3] || path.join(HERE, 'dist-cg'));
const ZIPDIR = path.resolve(process.argv[4] || path.dirname(OUT));
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const INIT_MS = 3000;

const game = fs.readFileSync(SRC, 'utf8');
const hash = crypto.createHash('sha1').update(game).digest('hex').slice(0, 8);
const gameVer = (game.match(/VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '0';
const fail = m => { console.error('build-cg: ' + m); process.exit(1); };

// Kopfteil des Fragments (title, meta, link, style) abtrennen
const headRe = /^(\s*(?:<title>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>|<style\b[^>]*>[\s\S]*?<\/style>|<!--[\s\S]*?-->)\s*)+/;
const m = game.match(headRe);
if (!m) fail('Kopfteil nicht gefunden');
let head = m[0], body = game.slice(m[0].length);
head = head.replace(/<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g, '');   // lokale Schriften statt Google Fonts
const title = (head.match(/<title>([\s\S]*?)<\/title>/) || [, 'Schürfland'])[1];
head = head.replace(/<title>[\s\S]*?<\/title>\s*/, '');

// Das (einzige) Spiel-Script nach game.js auslagern: der Lader startet es erst nach SDK.init()
const s0 = body.indexOf('<script>'), s1 = body.lastIndexOf('</script>');
if (s0 < 0 || s1 < s0) fail('Spiel-Script nicht gefunden');
let js = body.slice(s0 + '<script>'.length, s1);
const dom = body.slice(0, s0).trim(), after = body.slice(s1 + '</script>'.length).trim();
if (/<script\b/i.test(dom + after)) fail('weitere <script>-Blöcke im Spiel: Lader müsste angepasst werden');
// Ranglisten- und App-Adressen leeren (im Portal ohnehin aus; so steht keine fremde Adresse im Build)
const strip = (re, what) => { if (!re.test(js)) fail(what + ' nicht gefunden (Spiel geändert?)'); js = js.replace(re, '$1\'\''); };
strip(/(RANG_URL = )'https:\/\/[a-z0-9]+\.supabase\.co'/, 'RANG_URL');
strip(/(RANG_KEY = )'[^']*'/, 'RANG_KEY');
strip(/(APP_URL = )'[^']*github\.io[^']*'/, 'APP_URL');
if (!/const PORTAL = \(\(\) =>/.test(js) || !/window\.SFL_CG/.test(js)) fail('Spiel ohne CG-Portal-Adapter (PORTAL/SFL_CG): erst 5.1 E einbauen');

// Ausgabe: nur die eigenen Dateien ersetzen, nie den ganzen Ordner löschen
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'game.js', 'fonts.css']) fs.rmSync(path.join(OUT, f), { force: true });
fs.rmSync(path.join(OUT, 'fonts'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'fonts'));
const fontsCss = fs.readFileSync(path.join(HERE, 'fonts.css'), 'utf8').replace(/Nunito-(800|900)-/g, 'Nunito-700-');
const fontFiles = [...new Set([...fontsCss.matchAll(/url\((fonts\/[^)]+)\)/g)].map(x => x[1]))];
for (const f of fontFiles) fs.copyFileSync(path.join(HERE, f), path.join(OUT, f));
fs.writeFileSync(path.join(OUT, 'fonts.css'), fontsCss);
fs.writeFileSync(path.join(OUT, 'game.js'), js.trim() + '\n');

// Gleiches Grundgerüst wie im Artifact-Viewer und in der App (Safe Areas für den Vollbildmodus der CG-App)
const shellCss = `:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box}
body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}
img{max-width:100%}
[hidden]{display:none!important}`;

const loader = `<script>
(function () {
  var done = false;
  try { document.documentElement.style.background = getComputedStyle(document.body).backgroundColor; } catch (e) {}
  function boot(sdk, env) {
    if (done) return; done = true;
    window.SFL_CG = { sdk: sdk || null, env: env };
    try { var l = sdk && sdk.user && sdk.user.systemInfo && sdk.user.systemInfo.locale; if (typeof l === 'string' && l) window.SFL_LOCALE = l; } catch (e) {}
    var s = document.createElement('script'); s.src = 'game.js?v=${hash}'; document.body.appendChild(s);
  }
  var SDK = null; try { SDK = window.CrazyGames && window.CrazyGames.SDK; } catch (e) {}
  if (!SDK || typeof SDK.init !== 'function') { boot(null, 'none'); return; }
  var t = setTimeout(function () { boot(null, 'timeout'); }, ${INIT_MS});
  function ok() {
    clearTimeout(t); var env = ''; try { env = SDK.environment; } catch (e) {}
    if (env === 'local' || env === 'crazygames') { if (!done) { try { SDK.game.loadingStart(); } catch (e) {} } boot(SDK, env); } else boot(null, env || 'disabled');
  }
  try { Promise.resolve(SDK.init()).then(ok, function () { clearTimeout(t); boot(null, 'error'); }); } catch (e) { clearTimeout(t); boot(null, 'error'); }
})();
</script>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>${title}</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="fonts.css">
<style>
${shellCss}
</style>
${head.trim()}
<script src="${SDK_URL}"></script>
</head>
<body>
${dom}
${after}
${loader}
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// Prüfungen (Plan §8.6)
const all = html + js + fontsCss;
const bad = [];
if (/github\.io/.test(all)) bad.push('github.io');
if (/supabase/.test(all)) bad.push('supabase');
if (/serviceWorker|sw\.js|rel="manifest"|webmanifest/.test(all)) bad.push('Service Worker/Manifest');
if (/^(?!\s*\/\/).*\bSFL_APP\s*=(?!=)/m.test(all)) bad.push('SFL_APP gesetzt');   // Kommentare zählen nicht
if (/fonts\.(googleapis|gstatic)\.com/.test(all)) bad.push('Google Fonts');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(x => x[1]).concat([...fontsCss.matchAll(/url\(([^)]+)\)/g)].map(x => x[1]));
for (const r of refs) if (r !== SDK_URL && !r.startsWith('data:') && (/^[a-z]+:/i.test(r) || r.startsWith('/'))) bad.push('nicht relativ: ' + r);
if (bad.length) fail('Prüfung: ' + bad.join(', '));

// ZIP (index.html im Wurzelverzeichnis)
const files = ['index.html', 'game.js', 'fonts.css', ...fontFiles];
const zipName = `schuerfland-cg-${gameVer}.zip`, zipPath = path.join(ZIPDIR, zipName);
fs.mkdirSync(ZIPDIR, { recursive: true });
fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-q', '-X', '-9', zipPath, ...files], { cwd: OUT });
const sz = f => fs.statSync(path.join(OUT, f)).size, total = files.reduce((a, f) => a + sz(f), 0);
const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(`CG-Build: ${OUT} · Version ${gameVer}-${hash} · ${files.length} Dateien · ${kb(total)} (index.html ${kb(sz('index.html'))}, game.js ${kb(sz('game.js'))})`);
console.log(`ZIP: ${zipPath} · ${kb(fs.statSync(zipPath).size)}`);

// Einzeldatei für den Upload (das Portal nimmt keine ZIPs und keine Ordner): Schriften und Spiel stecken in einer index.html.
// Liegt in <repo>/crazygames/index.html, wenn das Skript im Repo läuft (Download-Link für den Besitzer).
{
  const one = process.argv[5] || path.join(ZIPDIR, 'crazygames-einzeldatei');
  let h = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8'), g = fs.readFileSync(path.join(OUT, 'game.js'), 'utf8');
  const css = fs.readFileSync(path.join(OUT, 'fonts.css'), 'utf8').replace(/url\((fonts\/[^)]+)\)/g, (m, f) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(OUT, f)).toString('base64') + ')');
  const link = '<link rel="stylesheet" href="fonts.css">', sdk = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
  const load = /s\.src = 'game\.js\?v=[^']*';/;
  if (!h.includes(link) || !h.includes(sdk) || !load.test(h) || g.includes('</script')) throw new Error('Einzeldatei: Anker nicht gefunden');
  h = h.split(link).join('<style>\n' + css + '\n</style>');
  h = h.replace(load, () => "s.textContent = document.getElementById('sfl-game').textContent;");
  const i = h.indexOf(sdk);
  h = h.slice(0, i) + '<script type="text/plain" id="sfl-game">' + g + '</script>\n' + h.slice(i);
  fs.mkdirSync(one, { recursive: true }); fs.writeFileSync(path.join(one, 'index.html'), h);
  console.log(`Einzeldatei: ${path.join(one, 'index.html')} · ${kb(Buffer.byteLength(h))}`);
}

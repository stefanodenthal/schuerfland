// Testet die gebaute App über einen lokalen Server: Laden, Offline-Speicher, Schriften, Manifest, Spielstart
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const DIST = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(8765, r));
  const base = 'http://localhost:8765/';
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [], external = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  p.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await p.goto(base);
  await p.waitForTimeout(2500);
  const info = await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      sw: !!reg, app: window.SFL_APP, lang: document.documentElement.lang,
      lilita: document.fonts.check('20px "Lilita One"'), nunito: document.fonts.check('900 16px Nunito'),
      manifest: !!document.querySelector('link[rel=manifest]'),
      hScroll: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  console.log('nach erstem Laden', JSON.stringify(info));
  await p.reload(); await p.waitForTimeout(1500);
  const ctrl = await p.evaluate(() => !!navigator.serviceWorker.controller);
  console.log('Offline-Speicher steuert Seite:', ctrl);
  const mf = await (await p.request.get(base + 'manifest.webmanifest')).json();
  console.log('Manifest:', mf.name, mf.display, mf.icons.length, 'Icons');
  await p.screenshot({ path: path.join(__dirname, 'shot-menu.png') });
  // Spiel starten
  const btn = await p.$$eval('button', bs => bs.map(x => x.textContent.trim()).filter(Boolean).slice(0, 6));
  console.log('Knöpfe:', btn);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Los geht|Weiter|Weiterspielen|Einsammeln/.test(x.textContent)); b && b.click(); });
  await p.waitForTimeout(1500);
  await p.mouse.move(200, 600); await p.mouse.down(); await p.mouse.move(200, 520, { steps: 8 }); await p.waitForTimeout(800); await p.mouse.up();
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(__dirname, 'shot-play.png') });
  // Offline neu laden
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(2000);
  const off = await p.evaluate(() => ({ title: document.title, game: !!document.getElementById('cv') || !!document.querySelector('canvas'), lilita: document.fonts.check('20px "Lilita One"') }));
  console.log('Offline geladen:', JSON.stringify(off));
  await p.screenshot({ path: path.join(__dirname, 'shot-offline.png') });
  console.log('Externe Anfragen:', external.length ? external : 'keine');
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close(); server.close();
})();

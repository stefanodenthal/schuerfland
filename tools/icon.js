// Zeichnet das App-Icon (Insel mit Erzfelsen, Baum und Spitzhacke) und speichert alle Größen als PNG
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'icons');
fs.mkdirSync(OUT, { recursive: true });

const drawFn = `
function draw(size, maskable) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const s = size / 1024;
  g.scale(s, s);
  // Himmel/Meer
  const bg = g.createLinearGradient(0, 0, 0, 1024);
  bg.addColorStop(0, '#5cc6e8'); bg.addColorStop(1, '#2186b0');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 1024);
  const k = maskable ? 0.78 : 0.92; g.translate(512, 540); g.scale(k, k); g.translate(-512, -540);
  // Wellen
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 14; g.lineCap = 'round';
  for (const [x, y] of [[170, 210], [800, 260], [140, 860], [860, 900]]) { g.beginPath(); g.arc(x, y, 46, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  // Insel: Sand und Gras
  g.fillStyle = '#e9d39b'; g.beginPath(); g.ellipse(512, 610, 400, 300, 0, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(440, 520, 40, 512, 600, 380);
  gr.addColorStop(0, '#9be06f'); gr.addColorStop(1, '#58b33f');
  g.fillStyle = gr; g.beginPath(); g.ellipse(512, 590, 360, 262, 0, 0, Math.PI * 2); g.fill();
  // Baum hinten links
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(300, 600, 90, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7a4d26'; g.fillRect(284, 470, 34, 130);
  g.fillStyle = '#3f8f35'; g.beginPath(); g.arc(300, 420, 110, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#56b043'; g.beginPath(); g.arc(270, 390, 78, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7fd062'; g.beginPath(); g.arc(250, 362, 30, 0, Math.PI * 2); g.fill();
  // Erzfelsen
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(590, 700, 210, 56, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5d5a57'; g.beginPath();
  g.moveTo(400, 690); g.lineTo(450, 520); g.lineTo(560, 440); g.lineTo(690, 470); g.lineTo(780, 580); g.lineTo(790, 690); g.closePath(); g.fill();
  g.fillStyle = '#7d7975'; g.beginPath();
  g.moveTo(430, 660); g.lineTo(470, 530); g.lineTo(560, 465); g.lineTo(670, 490); g.lineTo(740, 580); g.lineTo(600, 600); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(480, 540); g.lineTo(560, 480); g.lineTo(620, 492); g.lineTo(540, 560); g.closePath(); g.fill();
  // Goldadern
  for (const [x, y, r] of [[520, 600, 30], [610, 540, 24], [680, 620, 28], [560, 660, 18]]) {
    g.fillStyle = '#c99a12'; g.beginPath(); g.arc(x + 4, y + 5, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff4b8'; g.beginPath(); g.arc(x - r * .35, y - r * .35, r * .3, 0, Math.PI * 2); g.fill();
  }
  // Spitzhacke
  g.save(); g.translate(560, 420); g.rotate(-0.62);
  g.fillStyle = '#7a4d26'; g.fillRect(-20, -40, 40, 400);
  g.fillStyle = '#a06a3a'; g.fillRect(-20, -40, 14, 400);
  g.fillStyle = '#9aa3ad'; g.beginPath();
  g.moveTo(-250, 40); g.quadraticCurveTo(0, -110, 250, 40); g.lineTo(230, 62); g.quadraticCurveTo(0, -50, -230, 62); g.closePath(); g.fill();
  g.fillStyle = '#d7dde3'; g.beginPath(); g.moveTo(-230, 34); g.quadraticCurveTo(0, -96, 230, 34); g.lineTo(220, 40); g.quadraticCurveTo(0, -78, -220, 40); g.closePath(); g.fill();
  g.fillStyle = '#5c646d'; g.fillRect(-34, -64, 68, 70);
  g.restore();
  // Funkeln
  g.fillStyle = '#fff';
  for (const [x, y, r] of [[720, 470, 22], [470, 470, 14]]) { g.beginPath(); g.moveTo(x, y - r * 2); g.lineTo(x + r * .5, y); g.lineTo(x, y + r * 2); g.lineTo(x - r * .5, y); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x - r * 2, y); g.lineTo(x, y + r * .5); g.lineTo(x + r * 2, y); g.lineTo(x, y - r * .5); g.closePath(); g.fill(); }
  return c.toDataURL('image/png');
}`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<html><body></body></html>');
  await p.addScriptTag({ content: drawFn });
  const jobs = [['icon-512.png', 512, false], ['icon-192.png', 192, false], ['apple-touch-icon.png', 180, false], ['icon-maskable-512.png', 512, true], ['favicon-32.png', 32, false], ['icon-1024.png', 1024, false]];
  for (const [name, size, mask] of jobs) {
    const data = await p.evaluate(([s, m]) => draw(s, m), [size, mask]);
    fs.writeFileSync(path.join(OUT, name), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('icons ok');
  await b.close();
})();

# Schürfland

Sammel- und Aufbauspiel fürs Handy als installierbare Web-App (offline, Vollbild).

**Spielen:** https://stefanodenthal.github.io/schuerfland/

## Installieren
- **iPhone (Safari):** Seite öffnen → unten *Teilen* → *Zum Home-Bildschirm*.
- **Android (Chrome):** Menü ⋮ → *App installieren*.

## Spielstand mitnehmen
Im alten Spiel: Einstellungen → *Spielstand übertragen* → *Code kopieren*.
In der App: Einstellungen → *Spielstand übertragen* → *Code einfügen*.

## Aufbau
- `index.html`, `sw.js`, `manifest.webmanifest`, `fonts/`, `icons/`: die veröffentlichte App
- `tools/`: Bauwerkzeuge. Neue Spielversion als `tools/schuerfland-spiel.html` ablegen, dann im Ordner `tools`:
  `node build.js schuerfland-spiel.html ..` (baut die App ins Hauptverzeichnis)

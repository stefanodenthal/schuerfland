#!/bin/sh
# Neue Version veröffentlichen: tools/schuerfland-spiel.html ersetzen, dann dieses Skript.
# Baut die App (GitHub Pages) und die CrazyGames-Einzeldatei crazygames/index.html.
set -e
cd "$(dirname "$0")"
node build.js schuerfland-spiel.html ..
T=$(mktemp -d)
node build-cg.js schuerfland-spiel.html "$T/dist-cg" "$T" ../crazygames
rm -rf "$T"

#!/bin/sh
# Builds the page into dist-night (so the served dist is left alone) and takes stills of the night scene.
#   sh tools/night.sh <out folder under shots/work> [more shots.mjs arguments]
cd "$(dirname "$0")/.." || exit 1
out="$1"; shift
node node_modules/vite/bin/vite.js build --config vite.config.mjs --outDir dist-night > .night-build.log 2>&1 || { grep -v "^ *at " .night-build.log | head -30; echo "BUILD FAILED: no stills taken"; exit 1; }
grep -E "built in" .night-build.log
node tools/shots.mjs --dist dist-night --query "scene=aurora" --out "shots/work/$out" "$@" 2>&1 | tail -25

#!/bin/bash
# ship — push portfolio to GitHub
# Usage: ./ship.sh "optional commit message"

cd "/Users/wallymo/portfolioise/misterpavano.github.io" || exit 1
git add -A
git commit -m "${1:-Portfolio update}"
gh auth switch --user wallymo 2>/dev/null
git push origin main
echo "✓ Live at wallymo.github.io"

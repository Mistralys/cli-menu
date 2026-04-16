#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Ensure dist/ is built (required for self-hosted menu)
if [ ! -f "dist/index.js" ]; then
  echo "Building dist/..."
  npm run build
fi

node scripts/cli.js "$@"

#!/bin/bash
set -e

cd "$(dirname "$0")"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  bun install
fi

# Start the dev server
echo "Starting React test app on http://localhost:3000"
bun run dev

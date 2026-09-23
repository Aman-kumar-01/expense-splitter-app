#!/usr/bin/env bash
set -e

PROJECT="$HOME/Desktop/Projects/expense-splitter-app"
cd "$PROJECT"

echo "==> Installing dependencies..."
npm install

echo "==> TypeScript check..."
npx tsc --noEmit

echo "==> Starting EAS Android preview build..."
npx eas-cli build -p android --profile preview

echo
echo "Build submitted. Open the Expo build page shown above and use the browser Download build button."

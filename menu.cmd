@echo off
cd /d "%~dp0"

rem Ensure dependencies are installed
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

rem Ensure dist/ is built (required for self-hosted menu)
if not exist "dist\index.js" (
  echo Building dist/...
  call npm run build
)

node scripts/cli.js %*

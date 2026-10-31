@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to start the local preview.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:4173"
node preview-server.mjs
pause

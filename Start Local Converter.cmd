@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\vite" (
  call npm ci
  if errorlevel 1 goto failed
)
echo Open http://127.0.0.1:3000 in your browser.
echo Browser-only mode. Keep this window open. Press Ctrl+C to stop.
call npm run dev
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Startup failed. Read the error above, then check README.md.
pause
exit /b 1

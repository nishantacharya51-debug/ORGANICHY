@echo off
REM ORGANICHY - local launcher for Windows. Double-click to run.
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set PORT=3000

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Download the LTS installer from https://nodejs.org
  echo   (ORGANICHY needs version 18 or newer), run it, then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Starting ORGANICHY on http://localhost:%PORT%
echo     store   http://localhost:%PORT%/
echo     admin   http://localhost:%PORT%/admin   (password: organichy@2026 unless .env says otherwise)
echo.
echo   Close this window, or press ctrl-c in it, to stop the site.
echo.

if not exist ".env" echo   no .env file - using default settings. & echo.

start "" "http://localhost:%PORT%/"
node server.js
pause

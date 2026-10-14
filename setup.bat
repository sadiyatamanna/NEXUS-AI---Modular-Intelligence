@echo off
title NEXUS AI Setup
cd /d "%~dp0"

echo ===================================================
echo             NEXUS AI — Automated Setup
echo ===================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python from https://python.org and check "Add to PATH".
    pause
    exit /b 1
)

echo [1/4] Setting up Python virtual environment (.venv)...
if not exist ".venv" (
    python -m venv .venv
)

echo [2/4] Installing backend dependencies...
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

echo.
echo [3/4] Checking Node.js / npm...
where npm >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] Installing frontend npm packages...
    cd frontend
    call npm install
    echo [*] Building production frontend...
    call npm run build
    cd ..
) else (
    echo [i] Node.js not detected. The platform will run in standalone mode via FastAPI.
    echo     If you want frontend live development, install Node.js from https://nodejs.org
)

echo.
echo ===================================================
echo  Setup Complete! You can now launch NEXUS AI with:
echo    Double-click run.bat  OR  python start_nexus.py
echo ===================================================
echo.
pause

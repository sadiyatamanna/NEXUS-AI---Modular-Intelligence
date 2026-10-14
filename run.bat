@echo off
title NEXUS AI Launcher
cd /d "%~dp0"

echo ===================================================
echo             NEXUS AI — Platform Launcher
echo ===================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to your system PATH!
    echo Please install Python 3.10+ from https://www.python.org/downloads/
    echo IMPORTANT: Make sure to check "Add python.exe to PATH" during installation.
    echo.
    pause
    exit /b 1
)

python start_nexus.py

if %errorlevel% neq 0 (
    echo.
    echo [!] Launcher exited with an error.
    pause
)

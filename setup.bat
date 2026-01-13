@echo off
echo ========================================
echo Quantum Programming IDE Setup
echo ========================================
echo.

REM Change to script directory to ensure correct paths
cd /d "%~dp0"

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.10 or higher from https://www.python.org/
    pause
    exit /b 1
)

echo Python found!
echo.

REM Check if requirements.txt exists
if not exist "backend\requirements.txt" (
    echo ERROR: requirements.txt not found at backend\requirements.txt
    echo Current directory: %CD%
    echo Please ensure you are running this script from the project root directory.
    pause
    exit /b 1
)

REM Create virtual environment
echo Creating virtual environment...
if exist .venv (
    echo Virtual environment already exists. Removing old one...
    rmdir /s /q .venv
)
python -m venv .venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

echo Virtual environment created!
echo.

REM Activate virtual environment and install dependencies
echo Activating virtual environment and installing dependencies...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

echo Upgrading pip...
python -m pip install --upgrade pip

echo Installing dependencies...
echo Installing from: %CD%\backend\requirements.txt
pip install -r "backend\requirements.txt"
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    echo Please check that backend\requirements.txt exists and is readable.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup completed successfully!
echo ========================================
echo.
echo To start the server, run: start.bat
echo.
pause

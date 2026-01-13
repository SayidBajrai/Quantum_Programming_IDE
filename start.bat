@echo off
echo ========================================
echo Starting Quantum Programming IDE Server
echo ========================================
echo.

REM Change to script directory to ensure correct paths
cd /d "%~dp0"

REM Check if virtual environment exists
if not exist .venv (
    echo ERROR: Virtual environment not found!
    echo Please run setup.bat first to set up the project.
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

REM Change to backend directory
cd backend
if errorlevel 1 (
    echo ERROR: Failed to change to backend directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Check if app.py exists
if not exist app.py (
    echo ERROR: app.py not found in backend directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Start Flask server
echo Starting Flask server...
echo. 
echo Press Ctrl+C to stop the server
echo.
python app.py

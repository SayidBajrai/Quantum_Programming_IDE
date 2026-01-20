@echo off
echo ========================================
echo Compiling Quantum Programming IDE
echo ========================================
echo.

REM Change to script directory
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

REM Check if PyInstaller is installed
echo Checking for PyInstaller...
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo PyInstaller not found. Installing...
    pip install pyinstaller
    if errorlevel 1 (
        echo ERROR: Failed to install PyInstaller
        pause
        exit /b 1
    )
)

REM Clean previous builds
echo Cleaning previous builds...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

REM Check if spec file exists and use it (it has metadata copying configured)
if exist QuantumIDE.spec (
    echo Using existing QuantumIDE.spec file...
    echo.
    pyinstaller QuantumIDE.spec
) else (
    echo Generating new spec file...
    echo.
    REM Build with PyInstaller
    REM --onefile: Create a single executable file
    REM --name: Name of the executable
    REM --add-data: Include templates and static files
    REM --hidden-import: Include hidden imports for Flask and dependencies
    REM --collect-all: Collect all submodules for specified packages
    pyinstaller --onefile ^
        --name "QuantumIDE" ^
        --add-data "frontend\templates;frontend\templates" ^
        --add-data "frontend\static;frontend\static" ^
        --hidden-import flask ^
        --hidden-import qiskit ^
        --hidden-import qiskit_aer ^
        --hidden-import qiskit_qasm3_import ^
        --hidden-import openqasm3 ^
        --hidden-import openqasm3._antlr ^
        --hidden-import antlr4 ^
        --hidden-import antlr4_python3_runtime ^
        --hidden-import matplotlib ^
        --hidden-import matplotlib.backends.backend_agg ^
        --hidden-import numpy ^
        --collect-all qiskit ^
        --collect-all qiskit_aer ^
        --collect-all qiskit_qasm3_import ^
        --collect-all openqasm3 ^
        --collect-all antlr4 ^
        --collect-all antlr4_python3_runtime ^
        --collect-all matplotlib ^
        backend\app.py
)

if errorlevel 1 (
    echo.
    echo ERROR: PyInstaller build failed!
    pause
    exit /b 1
)

REM Copy config.json to dist folder (not bundled in exe)
echo Copying config.json to dist folder...
if exist config.json (
    copy /Y config.json dist\config.json >nul
    if errorlevel 1 (
        echo WARNING: Failed to copy config.json to dist folder
    ) else (
        echo config.json copied successfully.
    )
) else (
    echo WARNING: config.json not found in project root
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Executable location: dist\QuantumIDE.exe
echo Config file location: dist\config.json
echo.
echo Note: The executable includes all dependencies.
echo You can distribute the entire 'dist' folder.
echo.
pause

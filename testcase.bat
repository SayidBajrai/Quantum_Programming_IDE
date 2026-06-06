@echo off
setlocal EnableDelayedExpansion

echo ========================================
echo Quantum Programming IDE - Test Suite
echo ========================================
echo.

cd /d "%~dp0"

set "TEST_DIR=%~dp0test case"
set "TEST_BASE_URL=http://127.0.0.1:5010"
set "SERVER_STARTED=0"
set "FAILURES=0"

if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found. Run setup.bat first.
    exit /b 1
)

call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    exit /b 1
)

netstat -ano | findstr /R /C:":5010 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo Starting temporary Flask server...
    start "QuantumIDE-TestServer" /MIN cmd /c "cd /d "%~dp0backend" && call "%~dp0.venv\Scripts\activate.bat" && python app.py"
    set "SERVER_STARTED=1"
    echo Waiting for server...
    set /a RETRIES=0
    :wait_for_server
    timeout /t 2 /nobreak >nul
    powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%TEST_BASE_URL%/home' -TimeoutSec 5).StatusCode } catch { exit 1 }" >nul 2>&1
    if errorlevel 1 (
        set /a RETRIES+=1
        if !RETRIES! LSS 15 goto wait_for_server
        echo ERROR: Server did not start on %TEST_BASE_URL%
        goto cleanup_fail
    )
    echo Server is ready.
) else (
    echo Server already running on port 5010.
)
echo.

echo [1/3] Running backend unit and API tests...
set "TEST_BASE_URL=%TEST_BASE_URL%"
python "%TEST_DIR%\test_api.py"
if errorlevel 1 (
    set /a FAILURES+=1
    echo FAIL: Backend/API tests
) else (
    echo PASS: Backend/API tests
)
echo.

echo [2/3] Installing UI test dependencies...
pushd "%TEST_DIR%"
if not exist "node_modules\playwright" (
    call npm install
    if errorlevel 1 (
        popd
        set /a FAILURES+=1
        echo FAIL: npm install
        goto cleanup
    )
)
call npx playwright install chromium >nul 2>&1
popd
echo.

echo [3/3] Running browser UI tests...
pushd "%TEST_DIR%"
set "TEST_BASE_URL=%TEST_BASE_URL%"
call npm run test:ui
if errorlevel 1 (
    set /a FAILURES+=1
    echo FAIL: UI tests
) else (
    echo PASS: UI tests
)
popd
echo.

goto cleanup

:cleanup_fail
set /a FAILURES+=1

:cleanup
if "%SERVER_STARTED%"=="1" (
    echo Stopping temporary test server...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":5010 .*LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo ========================================
if !FAILURES! GTR 0 (
    echo TEST SUITE FAILED - !FAILURES! stages
    echo ========================================
    exit /b 1
)

echo ALL TESTS PASSED
echo ========================================
exit /b 0

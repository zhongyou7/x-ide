@echo off

title X-IDE Launcher

REM Set default ports
set "PYTHON_PORT=8001"
set "NODE_PORT=8000"

REM Change to script directory
cd /d %~dp0 2>nul

cls
echo X-IDE Launcher
echo --------------
echo.

REM Check Python
echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo Python not found
) else (
    echo Python found
)

REM Check Node.js
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found
) else (
    echo Node.js found
)

REM Port conflict detection (simplified)
netstat -aon | findstr ":8000 " >nul
if not errorlevel 1 (
    echo WARNING: Port 8000 is in use, using 8002 for Node.js
    set "NODE_PORT=8002"
)

netstat -aon | findstr ":8001 " >nul
if not errorlevel 1 (
    echo WARNING: Port 8001 is in use, using 8003 for Python
    set "PYTHON_PORT=8003"
)

echo.
echo Node.js will use port: %NODE_PORT%
echo Python will use port: %PYTHON_PORT%
echo.

:MENU
echo Select an option:
echo 1. Start Node.js Server
echo 2. Start Python HTTP Server
echo 3. Exit
echo.

choice /c 123 /n /m "Enter your choice: "

if errorlevel 3 exit /b 0
if errorlevel 2 goto START_PYTHON
if errorlevel 1 goto START_NODE

:START_NODE
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not available
    pause
    goto MENU
)

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo Failed to install dependencies
        pause
        goto MENU
    )
)

echo Starting Node.js Server on port %NODE_PORT%
echo Set PORT=%NODE_PORT%
set "PORT=%NODE_PORT%"
node server.js
pause
goto MENU

:START_PYTHON
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not available
    pause
    goto MENU
)

echo Starting Python HTTP Server on port %PYTHON_PORT%
python -m http.server %PYTHON_PORT%
pause
goto MENU
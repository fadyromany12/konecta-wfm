@echo off
echo === Konecta WFM Frontend Setup ===
echo.

cd /d "%~dp0"

echo [1/4] Removing node_modules, .next, package-lock.json...
if exist node_modules (
    rmdir /s /q node_modules 2>nul
    if exist node_modules (
        echo   Warning: Could not fully remove node_modules. Close Cursor and any Node processes, then run this again.
        pause
        exit /b 1
    )
    echo   - Removed node_modules
)
if exist .next rmdir /s /q .next && echo   - Removed .next
if exist package-lock.json del /q package-lock.json && echo   - Removed package-lock.json
echo   Done.
echo.

echo [2/4] Clearing npm cache...
call npm cache clean --force 2>nul
echo   Done.
echo.

echo [3/4] Running npm install (may take 2-5 minutes)...
call npm install
if errorlevel 1 (
    echo   npm install failed. Try: npm install --legacy-peer-deps
    pause
    exit /b 1
)
echo   Done.
echo.

echo [4/4] Setup complete!
echo.
echo Start the dev server with:  npm run dev
echo Then open:  http://localhost:3000
echo.
pause

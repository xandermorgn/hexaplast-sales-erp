@echo off
echo ========================================
echo Hexaplast ERP - Quick Start
echo ========================================
echo.

echo [1/2] Starting Backend + Frontend...
start cmd /k "npm run dev"

echo [2/2] Opening Browser...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo ========================================
echo System Started Successfully!
echo ========================================
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Login with: admin / admin123
echo ========================================
pause

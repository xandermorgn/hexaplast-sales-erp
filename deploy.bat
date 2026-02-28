@echo off
REM ============================================
REM Hexaplast ERP - Production Deployment Script
REM Single Next.js process on port 3000
REM ============================================

echo.
echo ========================================
echo  Hexaplast ERP - Deployment Starting
echo ========================================
echo.

REM Step 1: Pull latest code from Git
echo [1/4] Pulling latest code from Git...
git pull
if %errorlevel% neq 0 (
    echo ERROR: Git pull failed!
    pause
    exit /b 1
)
echo Git pull completed successfully.
echo.

REM Step 2: Install dependencies
echo [2/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo Dependencies installed.
echo.

REM Step 3: Build Next.js
echo [3/4] Building Next.js...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo Build completed.
echo.

REM Step 4: Restart PM2 process
echo [4/4] Restarting PM2 process...
call pm2 restart hexaplast-erp
if %errorlevel% neq 0 (
    echo WARNING: Restart failed. Starting fresh...
    call pm2 start ecosystem.config.js
)

call pm2 save
echo.

REM Display PM2 status
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Current PM2 Status:
call pm2 list
echo.
echo To view logs, run: pm2 logs hexaplast-erp
echo To stop, run: pm2 stop hexaplast-erp
echo.
pause

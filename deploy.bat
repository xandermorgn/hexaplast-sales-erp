@echo off
REM ============================================
REM Hexaplast ERP - Production Deployment Script
REM Windows 10 On-Prem Server
REM ============================================

echo.
echo ========================================
echo  Hexaplast ERP - Deployment Starting
echo ========================================
echo.

REM Step 1: Pull latest code from Git
echo [1/5] Pulling latest code from Git...
git pull
if %errorlevel% neq 0 (
    echo ERROR: Git pull failed!
    pause
    exit /b 1
)
echo Git pull completed successfully.
echo.

REM Step 2: Install frontend dependencies
echo [2/5] Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend npm install failed!
    pause
    exit /b 1
)
echo Frontend dependencies installed.
echo.

REM Step 3: Install backend dependencies
echo [3/5] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Backend npm install failed!
    cd ..
    pause
    exit /b 1
)
cd ..
echo Backend dependencies installed.
echo.

REM Step 4: Build Next.js frontend
echo [4/5] Building Next.js frontend...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
echo Frontend build completed.
echo.

REM Step 5: Restart PM2 processes
echo [5/5] Restarting PM2 processes...
call pm2 restart hexaplast-erp-backend
if %errorlevel% neq 0 (
    echo WARNING: Backend restart failed. Starting fresh...
    call pm2 start ecosystem.config.js --only hexaplast-erp-backend
)

call pm2 restart hexaplast-erp-frontend
if %errorlevel% neq 0 (
    echo WARNING: Frontend restart failed. Starting fresh...
    call pm2 start ecosystem.config.js --only hexaplast-erp-frontend
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
echo To stop services, run: pm2 stop all
echo.
pause

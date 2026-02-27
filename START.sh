#!/bin/bash

echo "========================================"
echo "Hexaplast ERP - Quick Start"
echo "========================================"
echo ""

echo "[1/3] Starting Backend Server..."
cd backend
npm start &
BACKEND_PID=$!
sleep 3

echo "[2/3] Starting Frontend Server..."
cd ..
pnpm dev &
FRONTEND_PID=$!

echo "[3/3] Opening Browser..."
sleep 5
if command -v xdg-open > /dev/null; then
  xdg-open http://localhost:3000
elif command -v open > /dev/null; then
  open http://localhost:3000
fi

echo ""
echo "========================================"
echo "System Started Successfully!"
echo "========================================"
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Login with: admin / admin123"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop all servers"

wait

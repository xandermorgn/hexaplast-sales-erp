# Hexaplast ERP - Production Deployment Guide

## System Overview

**Hexaplast ERP** is a professional enterprise resource planning system for sales management, built for on-premises deployment on Windows 10 servers.

### Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Authentication**: bcrypt, session-based (no JWT)
- **Process Manager**: PM2
- **Real-time**: Socket.IO

### Architecture Principles
- Backend is the source of truth
- Session-based authentication with HTTP-only cookies
- No cloud dependencies
- No frontend persistence beyond sessionStorage
- All API calls use relative paths

---

## Prerequisites

### Required Software
1. **Node.js** (v18 or higher)
2. **Git** for version control
3. **PM2** for process management
   ```bash
   npm install -g pm2
   ```

### Server Requirements
- Windows 10 (or Windows Server)
- Minimum 4GB RAM
- Network access for LAN deployment
- Ports 3000 (frontend) and 4001 (backend) available

---

## Initial Setup

### 1. Clone Repository
```bash
git clone <your-repository-url>
cd "ERP - SALES"
```

### 2. Configure Environment Variables

#### Frontend (.env)
```bash
copy .env.example .env
```

Edit `.env` and set:
```env
NEXT_PUBLIC_API_BASE=http://192.168.1.100:4001
NODE_ENV=production
```
Replace `192.168.1.100` with your server's IP address.

#### Backend (backend/.env)
```bash
cd backend
copy .env.example .env
```

Edit `backend/.env` and set:
```env
PORT=4001
SESSION_SECRET=<generate-strong-random-string>
NODE_ENV=production
```

**CRITICAL**: Generate a strong SESSION_SECRET for production!

### 3. Install Dependencies
```bash
# From project root
npm install
cd backend
npm install
cd ..
```

Or use the convenience script:
```bash
npm run install:all
```

### 4. Build Frontend
```bash
npm run build
```

### 5. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

The `pm2 startup` command will provide instructions to enable PM2 to start on system boot.

---

## Deployment Workflow

### Automated Deployment (Recommended)
```bash
deploy.bat
```

This script will:
1. Pull latest code from Git
2. Install dependencies (frontend & backend)
3. Build Next.js frontend
4. Restart PM2 processes
5. Display status

### Manual Deployment Steps
```bash
# 1. Pull latest code
git pull

# 2. Install dependencies
npm install
cd backend && npm install && cd ..

# 3. Build frontend
npm run build

# 4. Restart services
pm2 restart hexaplast-erp-backend
pm2 restart hexaplast-erp-frontend
pm2 save
```

---

## PM2 Process Management

### View Status
```bash
pm2 list
```

### View Logs
```bash
# All logs
pm2 logs

# Backend only
pm2 logs hexaplast-erp-backend

# Frontend only
pm2 logs hexaplast-erp-frontend
```

### Restart Services
```bash
# Restart all
pm2 restart all

# Restart specific service
pm2 restart hexaplast-erp-backend
pm2 restart hexaplast-erp-frontend
```

### Stop Services
```bash
pm2 stop all
```

### Monitor Resources
```bash
pm2 monit
```

---

## Network Configuration

### LAN Access
To allow other devices on the network to access the ERP:

1. **Configure Frontend Environment**
   - Set `NEXT_PUBLIC_API_BASE` to server's LAN IP
   - Example: `http://192.168.1.100:4001`

2. **Windows Firewall**
   - Allow inbound connections on ports 3000 and 4001
   - Or disable firewall for private networks (not recommended for production)

3. **Access URLs**
   - Frontend: `http://<server-ip>:3000`
   - Backend API: `http://<server-ip>:4001`

### Finding Server IP
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

---

## Database Management

### Location
SQLite database is created automatically in `backend/` directory.

### Backup
```bash
# Create backup
copy backend\hexaplast.db backend\backups\hexaplast_%date%.db

# Or use automated backup script (create one)
```

### Seed Initial Data
```bash
cd backend
npm run seed
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3000
netstat -ano | findstr :4001

# Kill process by PID
taskkill /PID <pid> /F
```

### PM2 Not Starting
```bash
# Delete PM2 processes
pm2 delete all

# Start fresh
pm2 start ecosystem.config.js
pm2 save
```

### Build Failures
```bash
# Clear Next.js cache
npm run clean

# Reinstall dependencies
rmdir /s /q node_modules
rmdir /s /q backend\node_modules
npm run install:all

# Rebuild
npm run build
```

### Session Issues
- Ensure `SESSION_SECRET` is set in `backend/.env`
- Clear browser cookies
- Restart backend: `pm2 restart hexaplast-erp-backend`

---

## Security Checklist

- [ ] Strong `SESSION_SECRET` configured
- [ ] `.env` files not committed to Git
- [ ] Windows Firewall configured properly
- [ ] Regular database backups scheduled
- [ ] PM2 logs rotation enabled
- [ ] HTTPS configured (if needed)
- [ ] Admin passwords changed from defaults

---

## Maintenance

### Log Rotation
PM2 logs can grow large. Configure rotation:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Regular Backups
Create a scheduled task to backup:
- Database file (`backend/hexaplast.db`)
- Uploads folder (`backend/uploads/`)
- Environment files (`.env`)

### Updates
```bash
# Pull latest code
git pull

# Run deployment script
deploy.bat
```

---

## Development vs Production

### Development
```bash
npm run dev
```
Runs both frontend and backend in watch mode.

### Production
```bash
npm run build
pm2 start ecosystem.config.js
```
Optimized builds with PM2 process management.

---

## Support & Documentation

### Key Files
- `ecosystem.config.js` - PM2 configuration
- `deploy.bat` - Deployment automation
- `.env.example` - Environment template
- `package.json` - Dependencies and scripts

### Logs Location
- Frontend: `logs/pm2-frontend-*.log`
- Backend: `backend/logs/pm2-*.log`

### Common Commands
```bash
# Check status
pm2 list

# View logs
pm2 logs

# Restart all
pm2 restart all

# Deploy updates
deploy.bat
```

---

## Architecture Notes

### API Configuration
The system uses `lib/api.ts` for API base URL configuration:
- Reads from `NEXT_PUBLIC_API_BASE` environment variable
- Defaults to `http://localhost:4001` in development
- All API calls use the `apiUrl()` helper function
- No hardcoded external URLs

### Authentication Flow
1. User logs in via `/api/auth/login`
2. Backend creates session with HTTP-only cookie
3. Frontend stores minimal user data in sessionStorage
4. All requests include session cookie automatically
5. Backend validates session on protected routes

### Data Flow
1. Frontend makes API call using `apiUrl()`
2. Request includes session cookie
3. Backend validates session
4. Backend queries SQLite database
5. Backend returns JSON response
6. Frontend updates UI

---

**Deployment Date**: _Record deployment date here_  
**Deployed By**: _Record administrator name here_  
**Server IP**: _Record server IP here_  
**Version**: 1.0.0

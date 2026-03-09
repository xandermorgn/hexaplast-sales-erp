# Hexaplast ERP - Production Deployment Guide

## System Overview

**Hexaplast ERP** is a professional enterprise resource planning system for sales management, built for on-premises deployment on Windows 10 servers.

### Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS
- **Backend**: Next.js API Routes (unified single process)
- **Database**: SQLite (better-sqlite3)
- **Authentication**: bcrypt, session-based (no JWT)
- **Process Manager**: PM2

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
- Port 3000 available

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
NODE_ENV=production
```

Frontend must use only same-origin relative API paths (for example `/api/auth/login`).

#### Server Environment
Set `SESSION_SECRET` in `.env`:
```env
SESSION_SECRET=<generate-strong-random-string>
NODE_ENV=production
```

**CRITICAL**: Generate a strong SESSION_SECRET for production!

### 3. Install Dependencies
```bash
npm install
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

# 3. Build
npm run build

# 4. Restart service
pm2 restart hexaplast-erp
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
pm2 logs
pm2 logs hexaplast-erp
```

### Restart Service
```bash
pm2 restart hexaplast-erp
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

1. **Configure Environment**
   - Frontend calls relative paths only (for example `/api/auth/login`)
   - All API routes are handled by the same Next.js process

2. **Windows Firewall**
   - Allow inbound connections on port 3000

3. **Access URL**
   - `http://<server-ip>:3000`

### Finding Server IP
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

---

## Database Management

### Location
SQLite database is created automatically in `server/` directory.

### Backup
```bash
# Create backup
copy server\hexaplast.db backups\hexaplast_%date%.db
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3000

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
npm install

# Rebuild
npm run build
```

### Session Issues
- Ensure `SESSION_SECRET` is set in `.env`
- Clear browser cookies
- Restart: `pm2 restart hexaplast-erp`

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
- Database file (`server/hexaplast.db`)
- Uploads folder (`server/uploads/`)
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
- `logs/pm2-*.log`

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
The system uses a unified single-process architecture:
- Frontend and API routes run in the same Next.js process on port 3000
- Frontend requests use relative URLs (for example `/api/auth/login`)
- `lib/api.ts` enforces relative path behavior
- All API routes live under `app/api/`
- No separate backend server or proxy required

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

# Hexaplast ERP - Production Deployment Verification

## ✅ Configuration Verification

### API Configuration
- ✅ **Frontend API Calls**: Same-origin relative paths only (`/api/...`)
- ✅ **No Frontend Base URL Env**: frontend does not use an API base URL variable
- ✅ **Implementation**: `lib/api.ts` enforces relative-only API paths
- ✅ **Proxy**: `next.config.mjs` rewrites `/api/:path*` → `http://127.0.0.1:4001/api/:path*`
- ✅ **No hardcoded frontend backend origin**

### Authentication
- ✅ **Method**: Session-based authentication (no JWT)
- ✅ **Login Endpoint**: `/api/auth/login` (internal, relative path)
- ✅ **Session Storage**: HTTP-only cookies (backend managed)
- ✅ **Frontend Storage**: sessionStorage only (loginId, role, profileData)
- ✅ **No localStorage**: Confirmed - no localStorage usage in codebase

### Environment Variables
- ✅ **Frontend (.env)**:
  - `NODE_ENV` - Set to "production"
  
- ✅ **Backend (backend/.env)**:
  - `PORT` - Backend server port (default: 4001)
  - `SESSION_SECRET` - Strong random string for sessions
  - `NODE_ENV` - Set to "production"

### Dependencies
- ✅ **No cloud services**: All dependencies are on-prem compatible
- ✅ **Database**: SQLite (better-sqlite3) - file-based, no external DB
- ✅ **No external APIs**: All functionality is self-contained
- ✅ **Socket.IO**: Local WebSocket for real-time updates

## 📁 Git Configuration

### .gitignore Coverage
- ✅ node_modules/
- ✅ .env files (all variants)
- ✅ .next/ build output
- ✅ logs/
- ✅ uploads/
- ✅ dist/
- ✅ coverage/
- ✅ OS files (Thumbs.db, .DS_Store, etc.)
- ✅ IDE files (.vscode, .idea, etc.)
- ✅ Database files (*.db, *.sqlite)
- ✅ PM2 files (.pm2/, *.pid)
- ✅ Temporary files

### Environment Templates
- ✅ `.env.example` - Frontend configuration template
- ✅ `backend/.env.example` - Backend configuration template
- ✅ Both files include documentation and security notes

## 🚀 Deployment Files

### package.json Scripts
- ✅ `dev` - Development mode (frontend + backend)
- ✅ `build` - Production build (Next.js)
- ✅ `start` - Production start (Next.js)
- ✅ `lint` - Code linting
- ✅ `type-check` - TypeScript validation
- ✅ `install:all` - Install all dependencies
- ✅ `clean` - Clean build artifacts

### PM2 Configuration (ecosystem.config.js)
- ✅ Backend process: `hexaplast-erp-backend`
  - Script: `./backend/server.js`
  - Port: 4001
  - Memory limit: 500M
  - Logs: `backend/logs/pm2-*.log`
  
- ✅ Frontend process: `hexaplast-erp-frontend`
  - Script: Next.js start
  - Port: 3000
  - Memory limit: 1G
  - Logs: `logs/pm2-frontend-*.log`

### Deployment Script (deploy.bat)
- ✅ Git pull
- ✅ npm install (frontend)
- ✅ npm install (backend)
- ✅ npm run build
- ✅ PM2 restart with fallback to fresh start
- ✅ PM2 save
- ✅ Status display

## 🔒 Security Verification

### Session Security
- ✅ HTTP-only cookies (not accessible via JavaScript)
- ✅ Session secret required in backend/.env
- ✅ CORS configured for credentials
- ✅ Backend validates all sessions

### Data Persistence
- ✅ No localStorage usage
- ✅ Only sessionStorage for UI state (loginId, role, profileData)
- ✅ Backend is source of truth
- ✅ All data stored in SQLite database

### Network Security
- ✅ No external API calls
- ✅ No cloud dependencies
- ✅ All communication within LAN
- ✅ Configurable CORS for on-prem deployment

## 📋 Pre-Deployment Checklist

### Server Preparation
- [ ] Windows 10 server ready
- [ ] Node.js v18+ installed
- [ ] Git installed
- [ ] PM2 installed globally (`npm install -g pm2`)
- [ ] Ports 3000 and 4001 available
- [ ] Windows Firewall configured

### Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Confirm frontend uses relative API paths only (`/api/...`)
- [ ] Copy `backend/.env.example` to `backend/.env`
- [ ] Generate strong `SESSION_SECRET`
- [ ] Set `NODE_ENV=production` in both .env files

### Installation
- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Run `cd backend && npm install`
- [ ] Run `npm run build`
- [ ] Test build completes successfully

### PM2 Setup
- [ ] Run `pm2 start ecosystem.config.js`
- [ ] Verify both processes running: `pm2 list`
- [ ] Run `pm2 save`
- [ ] Run `pm2 startup` and follow instructions
- [ ] Test auto-restart on reboot

### Network Testing
- [ ] Access frontend: `http://<server-ip>:3000`
- [ ] Test login functionality
- [ ] Verify API calls work
- [ ] Test from another device on LAN
- [ ] Verify session persistence

### Database
- [ ] Verify SQLite database created in `backend/`
- [ ] Run seed script if needed: `npm run seed`
- [ ] Test database operations
- [ ] Set up backup schedule

## 🔍 Verification Commands

```bash
# Check Node.js version
node --version

# Check PM2 status
pm2 list

# View logs
pm2 logs

# Check ports
netstat -ano | findstr :3000
netstat -ano | findstr :4001

# Test API endpoint
curl http://127.0.0.1:4001/api/auth/check

# Check build output
dir .next

# Verify environment
echo %NODE_ENV%
```

## 📊 Post-Deployment Verification

### Functional Testing
- [ ] Login with master admin account
- [ ] Create customer inquiry
- [ ] Create quotation
- [ ] Create performa
- [ ] Create work order
- [ ] Upload product image
- [ ] Test real-time updates (Socket.IO)
- [ ] Test session persistence across page refresh
- [ ] Test logout functionality

### Performance Testing
- [ ] Monitor PM2 memory usage
- [ ] Check response times
- [ ] Test concurrent users
- [ ] Monitor database size
- [ ] Check log file sizes

### Security Testing
- [ ] Verify session cookies are HTTP-only
- [ ] Test unauthorized access blocked
- [ ] Verify CORS settings
- [ ] Check file upload restrictions
- [ ] Test SQL injection prevention

## 📝 Documentation

### Created Files
1. ✅ `.gitignore` - Comprehensive Git exclusions
2. ✅ `.env.example` - Frontend environment template
3. ✅ `backend/.env.example` - Backend environment template
4. ✅ `ecosystem.config.js` - PM2 configuration
5. ✅ `deploy.bat` - Windows deployment script
6. ✅ `README.deployment.md` - Complete deployment guide
7. ✅ `PRODUCTION-CHECKLIST.md` - This checklist

### Updated Files
1. ✅ `package.json` - Production-ready scripts
2. ✅ Project name changed to "hexaplast-erp"
3. ✅ Version set to 1.0.0

## 🎯 Production Readiness Status

### ✅ READY FOR DEPLOYMENT
- All configuration files created
- No hardcoded external URLs
- Session-based authentication configured
- API calls use same-origin relative paths only
- No cloud dependencies
- Frontend persistence limited to sessionStorage
- Production build configured with NODE_ENV=production
- Git-safe structure with proper .gitignore
- PM2 process management configured
- Windows deployment automation ready

### Architecture Compliance
- ✅ Backend is source of truth
- ✅ Session-based auth (no JWT)
- ✅ No localStorage usage
- ✅ All API calls via `apiUrl()` helper
- ✅ Environment-based configuration
- ✅ On-prem compatible (no cloud services)

## 🚨 Important Notes

1. **SESSION_SECRET**: Must be changed from example value in production
2. **Frontend API Calls**: Must remain relative (`/api/...`) with no absolute backend URL
3. **Firewall**: Ensure ports 3000 and 4001 are accessible on LAN
4. **Backups**: Set up regular database and uploads backups
5. **Logs**: Configure log rotation to prevent disk space issues
6. **Updates**: Use `deploy.bat` for all future deployments

---

**Status**: ✅ PRODUCTION READY  
**Last Updated**: 2026-02-27  
**Version**: 1.0.0

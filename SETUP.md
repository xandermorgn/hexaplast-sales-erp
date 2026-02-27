# Hexaplast ERP - Complete Setup Guide

## Phase 1: Authentication Backend (COMPLETE)

This guide covers the complete setup of the Hexaplast ERP system with the new SQLite + Express backend.

---

## Prerequisites

- Node.js 18+ installed
- npm or pnpm package manager
- Windows/Linux/macOS

---

## Backend Setup

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `bcrypt` - Password hashing
- `better-sqlite3` - SQLite database

### 3. Seed the Database

```bash
npm run seed
```

**Output:**
```
Starting database seed...

✓ Master Admin created successfully

Credentials:
  Login ID: admin
  Password: admin123

⚠ IMPORTANT: Change this password after first login!

✓ Admin user created
  Login ID: admin1
  Password: admin456

✓ Employee created: Rahul Sharma (store)
  Login ID: store1
  Password: emp123

✓ Employee created: Priya Mehta (design)
  Login ID: design1
  Password: emp123

✓ Employee created: Amit Kumar (production)
  Login ID: prod1
  Password: emp123

✓ Employee created: Sneha Patel (qc)
  Login ID: qc1
  Password: emp123

✓ Database seeded successfully!

Total users created: 6
```

### 4. Start Backend Server

```bash
npm start
```

**Output:**
```
Database initialized successfully
✓ Hexaplast ERP Backend running on http://localhost:3001
✓ Database: SQLite
✓ Auth endpoint: http://localhost:3001/api/auth/login
```

**For development with auto-reload:**
```bash
npm run dev
```

---

## Frontend Setup

### 1. Navigate to Root Directory

```bash
cd ..
```

### 2. Install Frontend Dependencies

```bash
pnpm install
```

### 3. Start Frontend Development Server

```bash
pnpm dev
```

**Output:**
```
▲ Next.js 16.0.10
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

---

## Testing the System

### 1. Open Browser

Navigate to: `http://localhost:3000`

### 2. Test Login with Different Roles

#### Master Admin
- **Login ID:** `admin`
- **Password:** `admin123`
- **Expected:** Redirect to `/master-admin-dashboard`
- **Access:** Full system access, employee management, lock/unlock permissions

#### Admin
- **Login ID:** `admin1`
- **Password:** `admin456`
- **Expected:** Redirect to `/admin-dashboard`
- **Access:** Work orders, status chart (full edit), team permissions

#### Store Employee
- **Login ID:** `store1`
- **Password:** `emp123`
- **Expected:** Redirect to `/store-dashboard`
- **Access:** Check materials, PRS, purchase orders, status chart (limited)

#### Design Employee
- **Login ID:** `design1`
- **Password:** `emp123`
- **Expected:** Redirect to `/design-dashboard`
- **Access:** Design check, BOM management, status chart (limited)

#### Production Employee
- **Login ID:** `prod1`
- **Password:** `emp123`
- **Expected:** Redirect to `/production-dashboard`
- **Access:** Receive materials, production workflow, status chart (limited)

#### QC Employee
- **Login ID:** `qc1`
- **Password:** `emp123`
- **Expected:** Redirect to `/qc-dashboard`
- **Access:** Mechanical/Electrical/Final QC, dispatch, packing, status chart (limited)

---

## Architecture Overview

### Backend (Port 3001)

```
backend/
├── config/
│   └── database.js          # SQLite initialization & schema
├── controllers/
│   └── authController.js    # Login logic with bcrypt verification
├── routes/
│   └── authRoutes.js        # /api/auth/login endpoint
├── scripts/
│   └── seed.js              # Database seeding script
├── utils/
│   └── hash.js              # bcrypt hashing utilities
├── data/
│   └── hexaplast.db         # SQLite database (auto-created)
└── server.js                # Express server entry point
```

### Frontend (Port 3000)

```
app/
├── page.tsx                 # Login page (updated to use backend)
├── admin-dashboard/
├── master-admin-dashboard/
├── store-dashboard/
├── design-dashboard/
├── production-dashboard/
└── qc-dashboard/
```

---

## API Specification

### POST /api/auth/login

**Endpoint:** `http://localhost:3001/api/auth/login`

**Request Body:**
```json
{
  "loginId": "admin",
  "password": "admin123"
}
```

**Success Response (200):**
```json
{
  "Login": "admin",
  "Role": "Master Admin",
  "Department": ""
}
```

**Error Response (401):**
```json
{
  "error": "Invalid credentials",
  "message": "User ID is invalid"
}
```

**Error Response (400):**
```json
{
  "error": "Missing credentials",
  "message": "loginId and password are required"
}
```

---

## Database Schema

### users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('master_admin', 'admin', 'employee')),
  department TEXT CHECK(department IN ('store', 'design', 'production', 'qc', NULL)),
  employee_id TEXT,
  contact TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_id ON users(login_id);
```

---

## Security Features

✅ **bcrypt Password Hashing** - 12 rounds (industry standard)  
✅ **SQL Injection Protection** - Prepared statements  
✅ **CORS Restriction** - Only localhost:3000 allowed  
✅ **No Password Exposure** - Passwords never returned in responses  
✅ **Proper HTTP Status Codes** - 200, 400, 401, 500  
✅ **Input Validation** - Required field checks  

---

## Troubleshooting

### Backend won't start

**Error:** `Cannot find module 'express'`
- **Solution:** Run `npm install` in the backend directory

**Error:** `EADDRINUSE: address already in use :::3001`
- **Solution:** Port 3001 is already in use. Kill the process or change PORT in server.js

### Frontend can't connect to backend

**Error:** `Failed to fetch` or CORS error
- **Solution:** Ensure backend is running on port 3001
- **Check:** Backend CORS is configured for `http://localhost:3000`

### Login fails with valid credentials

**Check:**
1. Backend server is running
2. Database was seeded (`npm run seed`)
3. Check backend console for errors
4. Verify credentials match seeded users

### Database locked error

**Solution:** Close all connections to the database and restart the backend

---

## Production Deployment Notes

⚠️ **Before deploying to production:**

1. **Change all default passwords**
2. **Use environment variables** for sensitive config
3. **Enable HTTPS** for both frontend and backend
4. **Update CORS origin** to production domain
5. **Implement rate limiting** on login endpoint
6. **Add logging and monitoring**
7. **Regular database backups**
8. **Consider JWT tokens** for stateless auth (Phase 2)

---

## What Changed from Previous Implementation

### ❌ Removed
- n8n webhook authentication
- Google Sheets as user database
- External API dependencies

### ✅ Added
- Local Express backend (Node.js)
- SQLite database (single source of truth)
- bcrypt password hashing
- Proper HTTP status codes
- Database seeding script
- Health check endpoint

### 🔄 Modified
- Frontend login: Changed fetch URL from n8n to `http://localhost:3001/api/auth/login`
- **No other frontend changes** - all routes, UI, and logic remain identical

---

## Next Steps (Future Phases)

- **Phase 2:** JWT token-based authentication
- **Phase 3:** Work order management backend
- **Phase 4:** Real-time status chart sync
- **Phase 5:** Employee management CRUD
- **Phase 6:** Department workflow APIs

---

## Support

For issues or questions:
- Check backend logs in terminal
- Verify database exists: `backend/data/hexaplast.db`
- Test health endpoint: `http://localhost:3001/health`
- Review this setup guide

---

**System Status:** ✅ Phase 1 Complete - Authentication Backend Operational

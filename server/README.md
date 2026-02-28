# Hexaplast ERP Backend

Enterprise-grade authentication backend for Hexaplast ERP system.

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: SQLite (sql.js - pure JavaScript, no compilation required)
- **Security**: bcrypt (12 rounds)
- **CORS**: Enabled for localhost:3000

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Seed Database

```bash
npm run seed
```

This creates:
- Master Admin (login: `admin`, password: `admin123`)
- Admin (login: `admin1`, password: `admin456`)
- 4 Department Employees (login: `store1`, `design1`, `prod1`, `qc1`, password: `emp123`)

### 3. Start Server

```bash
npm start
```

Server runs on: `http://localhost:3001`

### Development Mode (with auto-reload)

```bash
npm run dev
```

## API Endpoints

### POST /api/auth/login

**Request:**
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

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "Hexaplast ERP Backend is running"
}
```

## Database Schema

### users table

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| login_id | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| name | TEXT | NOT NULL |
| role | TEXT | NOT NULL (master_admin, admin, employee) |
| department | TEXT | NULLABLE (store, design, production, qc) |
| employee_id | TEXT | NULLABLE |
| contact | TEXT | NULLABLE |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

## Security Features

- bcrypt password hashing (12 rounds)
- SQL injection protection (prepared statements)
- CORS restricted to frontend origin
- No password exposure in responses
- Proper HTTP status codes

## Default Credentials

**⚠️ CHANGE THESE AFTER FIRST LOGIN**

| Role | Login ID | Password | Department |
|------|----------|----------|------------|
| Master Admin | admin | admin123 | - |
| Admin | admin1 | admin456 | - |
| Employee | store1 | emp123 | Store |
| Employee | design1 | emp123 | Design |
| Employee | prod1 | emp123 | Production |
| Employee | qc1 | emp123 | QC |

## Folder Structure

```
backend/
├── config/
│   └── database.js       # SQLite initialization
├── controllers/
│   └── authController.js # Login logic
├── routes/
│   └── authRoutes.js     # Auth endpoints
├── scripts/
│   └── seed.js           # Database seeding
├── utils/
│   └── hash.js           # bcrypt utilities
├── data/
│   └── hexaplast.db      # SQLite database (auto-created)
├── server.js             # Express server
├── package.json
└── README.md
```

## Notes

- Database file is created automatically in `data/hexaplast.db`
- SQLite is the single source of truth
- No JWT tokens yet (Phase 1)
- Frontend uses sessionStorage for now
- Response format matches existing frontend expectations exactly

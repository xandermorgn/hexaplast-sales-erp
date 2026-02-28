# Hexaplast ERP - Employee API Documentation

## Phase 2: Employee Management APIs

All employee endpoints require **Master Admin** authentication.

---

## Authentication

Include the master admin's login ID in the request:

**Header:**
```
x-user-id: admin
```

**OR Body/Query:**
```json
{
  "loginId": "admin"
}
```

---

## Endpoints

### 1. Create Employee

**POST** `/api/employees`

Creates a new employee record linked to an existing user.

**Request Body:**
```json
{
  "loginId": "admin",
  "user_id": 2,
  "employee_id": "EMP-001",
  "full_name": "Rahul Sharma",
  "contact_number": "+91-9876543210",
  "email": "rahul@hexaplast.com",
  "department": "store",
  "designation": "Store Manager",
  "date_of_joining": "2024-01-15"
}
```

**Required Fields:**
- `user_id` - Must exist in users table
- `employee_id` - Must be unique
- `full_name` - Employee's full name
- `department` - Must match user's department

**Success Response (201):**
```json
{
  "message": "Employee created successfully",
  "employee": {
    "id": 1,
    "user_id": 2,
    "employee_id": "EMP-001",
    "full_name": "Rahul Sharma",
    "contact_number": "+91-9876543210",
    "email": "rahul@hexaplast.com",
    "department": "store",
    "designation": "Store Manager",
    "date_of_joining": "2024-01-15",
    "status": "active",
    "created_at": "2024-12-25T18:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Missing required fields or validation error
- `403` - Not master admin
- `404` - User ID not found
- `409` - Employee ID already exists or user already has employee record

---

### 2. Get All Employees

**GET** `/api/employees?loginId=admin`

Retrieves all employee records with optional filters.

**Query Parameters:**
- `loginId` (required) - Master admin login ID
- `status` (optional) - Filter by status: `active` or `inactive`
- `department` (optional) - Filter by department: `store`, `design`, `production`, `qc`

**Examples:**
```
GET /api/employees?loginId=admin
GET /api/employees?loginId=admin&status=active
GET /api/employees?loginId=admin&department=store
GET /api/employees?loginId=admin&status=active&department=production
```

**Success Response (200):**
```json
{
  "count": 2,
  "employees": [
    {
      "id": 1,
      "user_id": 2,
      "employee_id": "EMP-001",
      "full_name": "Rahul Sharma",
      "contact_number": "+91-9876543210",
      "email": "rahul@hexaplast.com",
      "department": "store",
      "designation": "Store Manager",
      "date_of_joining": "2024-01-15",
      "status": "active",
      "created_at": "2024-12-25T18:00:00.000Z",
      "login_id": "store1",
      "user_name": "Rahul Sharma",
      "role": "employee"
    }
  ]
}
```

---

### 3. Get Single Employee

**GET** `/api/employees/:id?loginId=admin`

Retrieves a single employee by ID.

**Example:**
```
GET /api/employees/1?loginId=admin
```

**Success Response (200):**
```json
{
  "employee": {
    "id": 1,
    "user_id": 2,
    "employee_id": "EMP-001",
    "full_name": "Rahul Sharma",
    "contact_number": "+91-9876543210",
    "email": "rahul@hexaplast.com",
    "department": "store",
    "designation": "Store Manager",
    "date_of_joining": "2024-01-15",
    "status": "active",
    "created_at": "2024-12-25T18:00:00.000Z",
    "login_id": "store1",
    "user_name": "Rahul Sharma",
    "role": "employee"
  }
}
```

**Error Response:**
- `404` - Employee not found

---

### 4. Update Employee

**PUT** `/api/employees/:id`

Updates an existing employee record.

**Updatable Fields:**
- `full_name`
- `contact_number`
- `email`
- `designation`
- `date_of_joining`

**Cannot Update:**
- `user_id` (immutable)
- `employee_id` (immutable)
- `department` (immutable)

**Request Body:**
```json
{
  "loginId": "admin",
  "full_name": "Rahul Sharma Updated",
  "contact_number": "+91-9876543211",
  "email": "rahul.updated@hexaplast.com",
  "designation": "Senior Store Manager"
}
```

**Success Response (200):**
```json
{
  "message": "Employee updated successfully",
  "employee": {
    "id": 1,
    "user_id": 2,
    "employee_id": "EMP-001",
    "full_name": "Rahul Sharma Updated",
    "contact_number": "+91-9876543211",
    "email": "rahul.updated@hexaplast.com",
    "department": "store",
    "designation": "Senior Store Manager",
    "date_of_joining": "2024-01-15",
    "status": "active",
    "created_at": "2024-12-25T18:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - No fields to update
- `404` - Employee not found

---

### 5. Delete Employee (Soft Delete)

**DELETE** `/api/employees/:id?loginId=admin`

Soft deletes an employee by setting status to `inactive`.

**Example:**
```
DELETE /api/employees/1?loginId=admin
```

**Success Response (200):**
```json
{
  "message": "Employee deactivated successfully",
  "employee_id": "EMP-001"
}
```

**Error Responses:**
- `400` - Employee already inactive
- `404` - Employee not found

---

## Validation Rules

### 1. User ID Validation
- Must exist in `users` table
- Cannot create multiple employee records for same user (1:1 relationship)

### 2. Employee ID Validation
- Must be unique across all employees
- Cannot be changed after creation

### 3. Department Validation
- Must match the user's department
- If user has no department (admin/master_admin), any department is allowed

### 4. Status Validation
- Only two values allowed: `active` or `inactive`
- Soft delete sets status to `inactive`

---

## Security

### Role-Based Access Control

All employee endpoints are protected by `requireMasterAdmin` middleware:

- ✅ **Master Admin** - Full access to all operations
- ❌ **Admin** - No access (403 Forbidden)
- ❌ **Employee** - No access (403 Forbidden)

### Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required. Please provide login credentials."
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden",
  "message": "Access denied. Master Admin privileges required."
}
```

---

## Database Schema

### employees Table

```sql
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  department TEXT NOT NULL,
  designation TEXT,
  date_of_joining DATE,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_employee_user_id ON employees(user_id);
CREATE INDEX idx_employee_id ON employees(employee_id);
```

### Relationship

- **1:1** relationship between `users` and `employees`
- `user_id` references `users(id)`
- Cascade delete: Deleting a user also deletes their employee record

---

## Testing Examples

### Using curl (PowerShell)

**Create Employee:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/employees" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"loginId":"admin","user_id":2,"employee_id":"EMP-001","full_name":"Rahul Sharma","department":"store"}'
```

**Get All Employees:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/employees?loginId=admin" `
  -Method GET
```

**Update Employee:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/employees/1" `
  -Method PUT `
  -ContentType "application/json" `
  -Body '{"loginId":"admin","full_name":"Rahul Sharma Updated"}'
```

**Delete Employee:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/employees/1?loginId=admin" `
  -Method DELETE
```

---

## Notes

- All dates should be in ISO 8601 format: `YYYY-MM-DD`
- Employee records are soft-deleted (status set to `inactive`)
- Hard delete is not supported to maintain data integrity
- Frontend UI remains unchanged - these are backend-only APIs
- Google Sheets integration has been completely removed

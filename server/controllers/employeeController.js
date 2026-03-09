/**
 * Employee Controller
 * Handles all CRUD operations for employee management
 * Master Admin access only
 * 
 * CRITICAL: Employee creation is ATOMIC
 * Creates: users -> employees -> user_profiles in sequence
 * If any step fails, previous steps are rolled back
 */

import { get, query, run } from '../config/database.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import { hashPassword } from '../utils/hash.js';

function isStrongPassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

/**
 * Generate next Employee ID
 * GET /api/employees/next-id
 * 
 * Returns the next available employee ID in format: EMP-XXX
 * Auto-increments and ensures no duplicates exist
 */
export function getNextEmployeeId(req, res) {
  try {
    // Get all existing employee IDs to check for duplicates
    const allIds = query(`
      SELECT employee_id FROM employees 
      WHERE employee_id LIKE 'EMP-%'
    `);
    
    const existingIds = new Set(allIds.map(row => row.employee_id));
    
    // Get the highest existing employee_id that matches EMP-XXX pattern
    const result = get(`
      SELECT employee_id FROM employees 
      WHERE employee_id LIKE 'EMP-%' 
      ORDER BY CAST(SUBSTR(employee_id, 5) AS INTEGER) DESC 
      LIMIT 1
    `);

    let nextNumber = 1;
    if (result && result.employee_id) {
      // Extract number from EMP-XXX format
      const match = result.employee_id.match(/^EMP-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Keep incrementing until we find an ID that doesn't exist
    let nextId = `EMP-${nextNumber.toString().padStart(3, '0')}`;
    while (existingIds.has(nextId)) {
      nextNumber++;
      nextId = `EMP-${nextNumber.toString().padStart(3, '0')}`;
    }

    return res.status(200).json({
      next_employee_id: nextId
    });

  } catch (error) {
    console.error('Get next employee ID error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate next employee ID'
    });
  }
}

/**
 * Create new employee with user account (ATOMIC OPERATION)
 * POST /api/employees
 * 
 * This creates:
 * 1. User account (with hashed password) - FIRST
 * 2. Employee record (linked to user)
 * 3. User profile (UI data)
 * 
 * Required fields:
 * - login_id: Unique login ID for the user
 * - password: Plain text password (will be hashed)
 * - employee_id: Unique employee ID
 * - full_name: Employee full name
 * - role: User role (employee)
 */
export async function createEmployee(req, res) {
  let createdUserId = null;
  
  try {
    if (req.user?.role !== 'master_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only master_admin can create employees'
      });
    }

    const {
      login_id,
      password,
      employee_id: explicit_employee_id,
      full_name,
      contact_number,
      email,
      designation,
      role = 'employee'
    } = req.body;

    // Validation: Required fields for USER creation
    if (!login_id || !password) {
      return res.status(400).json({
        success: false,
        message: 'User ID and password are required'
      });
    }

    if (!full_name) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required'
      });
    }

    // Validate User ID format: lowercase, no spaces, 3-20 chars, alphanumeric + underscore
    const userIdRegex = /^[a-z0-9_]{3,20}$/;
    if (!userIdRegex.test(login_id)) {
      return res.status(400).json({
        success: false,
        message: 'User ID must be 3-20 characters, lowercase, alphanumeric or underscore only, no spaces'
      });
    }

    // Validate password strength
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and include uppercase, lowercase, and a digit'
      });
    }

    // Validate role - only employee role allowed
    if (role !== 'employee') {
      return res.status(400).json({
        success: false,
        message: 'Role must be "employee"'
      });
    }

    // Check if login_id already exists
    const existingUser = get('SELECT id FROM users WHERE login_id = ?', [login_id]);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User ID already exists'
      });
    }

    // Auto-generate employee_id if not provided
    let employee_id = explicit_employee_id;
    if (!employee_id) {
      const lastRow = get(
        `SELECT employee_id FROM employees WHERE employee_id LIKE 'EMP-%' ORDER BY CAST(SUBSTR(employee_id, 5) AS INTEGER) DESC LIMIT 1`
      );
      let nextNum = 1;
      if (lastRow && lastRow.employee_id) {
        const match = lastRow.employee_id.match(/^EMP-(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      employee_id = `EMP-${nextNum.toString().padStart(3, '0')}`;
    }

    // Check if employee_id already exists
    const existingEmployee = get('SELECT id FROM employees WHERE employee_id = ?', [employee_id]);
    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message: 'Employee ID already exists'
      });
    }

    // ========================================
    // STEP 1: Create USER account FIRST
    // ========================================
    const password_hash = await hashPassword(password);
    
    run(
      `INSERT INTO users (login_id, password_hash, name, role)
       VALUES (?, ?, ?, ?)`,
      [login_id, password_hash, full_name, role]
    );

    // Get the created user ID
    const newUser = get('SELECT id FROM users WHERE login_id = ?', [login_id]);
    if (!newUser) {
      throw new Error('Failed to create user account');
    }
    createdUserId = newUser.id;

    // ========================================
    // STEP 2: Create EMPLOYEE record
    // ========================================
    run(
      `INSERT INTO employees (user_id, employee_id, full_name, contact_number, email, designation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        createdUserId,
        employee_id,
        full_name,
        contact_number || null,
        email || null,
        designation || null
      ]
    );

    // ========================================
    // STEP 3: Create USER_PROFILE (UI data)
    // ========================================
    run(
      `INSERT INTO user_profiles (user_id, display_name, personal_phone, personal_email, photo_path)
       VALUES (?, ?, ?, ?, NULL)`,
      [createdUserId, full_name, contact_number || null, email || null]
    );

    // Fetch created employee with user info
    const newEmployee = get(
      `SELECT e.*, u.login_id, u.role, u.created_at 
       FROM employees e 
       JOIN users u ON e.user_id = u.id 
       WHERE e.employee_id = ?`,
      [employee_id]
    );

    // Audit log
    logAudit({
      entity_type: ENTITY_TYPES.EMPLOYEE,
      entity_id: newEmployee.id,
      action: AUDIT_ACTIONS.CREATE,
      old_value: null,
      new_value: { ...newEmployee, login_id: login_id },
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      employee: newEmployee,
      login_id: login_id
    });

  } catch (error) {
    console.error('Create employee error:', error);
    
    // ROLLBACK: If user was created but employee/profile failed, delete the user
    if (createdUserId) {
      try {
        run('DELETE FROM user_profiles WHERE user_id = ?', [createdUserId]);
        run('DELETE FROM employees WHERE user_id = ?', [createdUserId]);
        run('DELETE FROM users WHERE id = ?', [createdUserId]);
        console.log('Rolled back partial creation for user ID:', createdUserId);
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create employee record'
    });
  }
}

/**
 * Get all employees
 * GET /api/employees
 * 
 * Query params:
 * - status: Filter by status (active/inactive)
 */
export function getAllEmployees(req, res) {
  try {
    const { status } = req.query;

    let sql = `
      SELECT 
        e.*,
        u.login_id,
        u.name as user_name,
        u.role,
        u.created_at,
        up.photo_data,
        up.photo_mime
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = e.user_id
      WHERE 1=1
    `;
    const params = [];

    // Filter by status
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.id DESC';

    const rows = query(sql, params);

    // Convert photo_data BLOBs to base64 data URIs for JSON transport
    const employees = rows.map(row => {
      let photo_data_uri = null;
      if (row.photo_data) {
        const base64 = Buffer.from(row.photo_data).toString('base64');
        photo_data_uri = `data:${row.photo_mime || 'image/jpeg'};base64,${base64}`;
      }
      // Remove raw blob from response to keep payload clean
      const { photo_data, ...rest } = row;
      return { ...rest, photo_data_uri };
    });

    return res.status(200).json({
      count: employees.length,
      employees: employees
    });

  } catch (error) {
    console.error('Get employees error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch employees'
    });
  }
}

/**
 * Get single employee by ID
 * GET /api/employees/:id
 */
export function getEmployeeById(req, res) {
  try {
    const { id } = req.params;

    const employee = get(
      `SELECT 
        e.*,
        u.login_id,
        u.name as user_name,
        u.role
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ?`,
      [id]
    );

    if (!employee) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Employee not found'
      });
    }

    return res.status(200).json({
      employee: employee
    });

  } catch (error) {
    console.error('Get employee error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch employee'
    });
  }
}

/**
 * Update employee record
 * PUT /api/employees/:id
 * 
 * Updatable fields:
 * - full_name, contact_number, email, designation
 * Cannot update: user_id, employee_id
 */
export function updateEmployee(req, res) {
  try {
    const { id } = req.params;
    const {
      full_name,
      contact_number,
      email,
      designation
    } = req.body;

    // Check if employee exists
    const employee = get('SELECT * FROM employees WHERE id = ?', [id]);
    if (!employee) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Employee not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (full_name !== undefined) {
      updates.push('full_name = ?');
      params.push(full_name);
    }
    if (contact_number !== undefined) {
      updates.push('contact_number = ?');
      params.push(contact_number);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (designation !== undefined) {
      updates.push('designation = ?');
      params.push(designation);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No fields to update'
      });
    }

    params.push(id);

    run(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Fetch updated employee
    const updated = get('SELECT * FROM employees WHERE id = ?', [id]);

    // Audit log
    logAudit({
      entity_type: ENTITY_TYPES.EMPLOYEE,
      entity_id: id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: employee,
      new_value: updated,
      req
    });

    return res.status(200).json({
      message: 'Employee updated successfully',
      employee: updated
    });

  } catch (error) {
    console.error('Update employee error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update employee'
    });
  }
}

/**
 * Hard delete employee (permanently remove from database)
 * DELETE /api/employees/:id
 * 
 * Removes employee, user, and user_profile records
 * This completely removes access to the system
 */
export function deleteEmployee(req, res) {
  try {
    const { id } = req.params;

    // Check if employee exists and get user_id
    const employee = get('SELECT * FROM employees WHERE id = ?', [id]);
    if (!employee) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Employee not found'
      });
    }

    const userId = employee.user_id;
    const employeeId = employee.employee_id;

    // Audit log BEFORE deletion
    logAudit({
      entity_type: ENTITY_TYPES.EMPLOYEE,
      entity_id: id,
      action: AUDIT_ACTIONS.DELETE,
      old_value: employee,
      new_value: null,
      req
    });

    // Hard delete in reverse order of creation (profile -> employee -> user)
    // This ensures foreign key constraints are satisfied
    run('DELETE FROM user_profiles WHERE user_id = ?', [userId]);
    run('DELETE FROM employees WHERE id = ?', [id]);
    run('DELETE FROM users WHERE id = ?', [userId]);

    return res.status(200).json({
      success: true,
      message: 'Employee deleted successfully',
      employee_id: employeeId
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete employee'
    });
  }
}

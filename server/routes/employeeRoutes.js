/**
 * Employee Routes
 * REST API endpoints for employee management
 * All routes protected by session validation + master_admin role
 */

import express from 'express';
import { requireSession, requireMasterAdminSession } from '../middleware/sessionMiddleware.js';
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getNextEmployeeId
} from '../controllers/employeeController.js';

const router = express.Router();

// Apply session validation and master_admin role check to all employee routes
router.use(requireSession);
router.use(requireMasterAdminSession);

/**
 * POST /api/employees
 * Create new employee record
 * 
 * Body:
 * {
 *   "user_id": 1,
 *   "employee_id": "EMP-001",
 *   "full_name": "John Doe",
 *   "contact_number": "+91-9876543210",
 *   "email": "john@example.com",
 *   "designation": "Sales Executive"
 * }
 */
router.post('/', createEmployee);

/**
 * GET /api/employees
 * Get all employees
 * 
 * Query params:
 * - status: active|inactive (optional)
 */
router.get('/', getAllEmployees);

/**
 * GET /api/employees/next-id
 * Get next auto-generated employee ID
 * MUST be before /:id route to avoid being caught by it
 */
router.get('/next-id', getNextEmployeeId);

/**
 * GET /api/employees/:id
 * Get single employee by ID
 */
router.get('/:id', getEmployeeById);

/**
 * PUT /api/employees/:id
 * Update employee record
 * 
 * Body (all fields optional):
 * {
 *   "full_name": "John Doe Updated",
 *   "contact_number": "+91-9876543211",
 *   "email": "john.updated@example.com",
 *   "designation": "Senior Sales Executive"
 * }
 */
router.put('/:id', updateEmployee);

/**
 * DELETE /api/employees/:id
 * Soft delete employee (set status to inactive)
 */
router.delete('/:id', deleteEmployee);

export default router;

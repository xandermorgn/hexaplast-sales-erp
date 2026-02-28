/**
 * Audit Routes
 * REST API endpoints for audit log access
 * Master Admin only
 */

import express from 'express';
import { requireSession, requireMasterAdminSession } from '../middleware/sessionMiddleware.js';
import { getAuditLogs, getAuditStats } from '../controllers/auditController.js';

const router = express.Router();

// Apply session validation and master admin check to all routes
router.use(requireSession);
router.use(requireMasterAdminSession);

/**
 * GET /api/audit
 * Get audit logs with filtering and pagination
 */
router.get('/', getAuditLogs);

/**
 * GET /api/audit/stats
 * Get audit log statistics
 */
router.get('/stats', getAuditStats);

export default router;

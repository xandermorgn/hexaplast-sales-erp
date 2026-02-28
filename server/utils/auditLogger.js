/**
 * Audit Logger Utility
 * Immutable, append-only audit logging system
 * Records all meaningful state changes with user context
 */

import { run } from '../config/database.js';

/**
 * Log an audit entry
 * @param {Object} params
 * @param {string} params.entity_type - Type of entity (e.g., 'employee', 'work_order')
 * @param {number} params.entity_id - ID of the entity
 * @param {string} params.action - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
 * @param {Object|string|null} params.old_value - Previous state (will be JSON stringified)
 * @param {Object|string|null} params.new_value - New state (will be JSON stringified)
 * @param {Object} params.req - Express request object (contains req.user from session)
 */
export function logAudit({ entity_type, entity_id, action, old_value, new_value, req }) {
  try {
    // Validate required parameters
    if (!entity_type || !entity_id || !action || !req || !req.user) {
      console.error('Audit log error: Missing required parameters');
      return;
    }

    // Server Admin bypasses audit logs completely
    if (req.user.role === 'server_admin') {
      return;
    }

    // Extract user context from session
    const { id: performed_by, role: performed_role } = req.user;

    // Serialize values to JSON strings
    const old_value_json = old_value !== null && old_value !== undefined 
      ? (typeof old_value === 'string' ? old_value : JSON.stringify(old_value))
      : null;

    const new_value_json = new_value !== null && new_value !== undefined
      ? (typeof new_value === 'string' ? new_value : JSON.stringify(new_value))
      : null;

    // Insert audit log entry (append-only, no UPDATE or DELETE)
    run(
      `INSERT INTO audit_logs (
        entity_type, 
        entity_id, 
        action, 
        old_value, 
        new_value, 
        performed_by, 
        performed_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entity_type,
        entity_id,
        action,
        old_value_json,
        new_value_json,
        performed_by,
        performed_role
      ]
    );

    // Log to console for debugging (optional, can be removed in production)
    console.log(`[AUDIT] ${action} ${entity_type}:${entity_id} by ${performed_role}`);

  } catch (error) {
    // Never throw errors from audit logger to avoid breaking main operations
    console.error('Audit logging failed:', error);
  }
}

/**
 * Helper function to create a snapshot of an object for audit logging
 * Useful for capturing state before and after changes
 * @param {Object} obj - Object to snapshot
 * @param {Array<string>} fields - Fields to include in snapshot
 * @returns {Object} Snapshot object
 */
export function createSnapshot(obj, fields) {
  if (!obj) return null;
  
  const snapshot = {};
  fields.forEach(field => {
    if (obj[field] !== undefined) {
      snapshot[field] = obj[field];
    }
  });
  
  return snapshot;
}

/**
 * Action constants for consistency
 */
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  PRODUCTION_PUSH: 'PRODUCTION_PUSH',
  START: 'START',
  COMPLETE: 'COMPLETE',
  ACTIVATE: 'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT'
};

/**
 * Entity type constants for consistency
 */
export const ENTITY_TYPES = {
  EMPLOYEE: 'employee',
  USER: 'user',
  PROFILE: 'profile',
  CUSTOMER_INQUIRY: 'customer_inquiry',
  PRODUCT_CATEGORY: 'product_category',
  MACHINE: 'machine',
  SPARE_PRODUCT: 'spare_product',
  QUOTATION: 'quotation',
  PERFORMA_INVOICE: 'performa_invoice',
  PART: 'part',
  BOM: 'bom',
  WORK_ORDER: 'work_order',
  SYSTEM_SETTING: 'system_setting',
  WORK_ORDER_STEP: 'work_order_step',
  PRODUCTION_SUB_STAGE: 'production_sub_stage',
  QC_SUB_STAGE: 'qc_sub_stage'
};

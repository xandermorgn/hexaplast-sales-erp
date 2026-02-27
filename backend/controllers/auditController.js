/**
 * Audit Controller
 * Handles read-only access to audit logs
 * Master Admin only
 */

import { query } from '../config/database.js';

/**
 * Get audit logs with filtering
 * GET /api/audit
 * Query params:
 * - entity_type: Filter by entity type
 * - entity_id: Filter by entity ID
 * - performed_by: Filter by user ID
 * - action: Filter by action type
 * - limit: Number of records (default 100, max 1000)
 * - offset: Pagination offset
 */
export function getAuditLogs(req, res) {
  try {
    const {
      entity_type,
      entity_id,
      performed_by,
      action,
      limit = 100,
      offset = 0
    } = req.query;

    // Validate limit
    const parsedLimit = Math.min(parseInt(limit) || 100, 1000);
    const parsedOffset = parseInt(offset) || 0;

    let sql = `
      SELECT 
        al.*,
        u.login_id as performed_by_login,
        u.name as performed_by_name
      FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (entity_type) {
      sql += ' AND al.entity_type = ?';
      params.push(entity_type);
    }

    if (entity_id) {
      sql += ' AND al.entity_id = ?';
      params.push(parseInt(entity_id));
    }

    if (performed_by) {
      sql += ' AND al.performed_by = ?';
      params.push(parseInt(performed_by));
    }

    if (action) {
      sql += ' AND al.action = ?';
      params.push(action);
    }

    // Order by most recent first
    sql += ' ORDER BY al.performed_at DESC';

    // Pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(parsedLimit, parsedOffset);

    const logs = query(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];

    if (entity_type) {
      countSql += ' AND entity_type = ?';
      countParams.push(entity_type);
    }
    if (entity_id) {
      countSql += ' AND entity_id = ?';
      countParams.push(parseInt(entity_id));
    }
    if (performed_by) {
      countSql += ' AND performed_by = ?';
      countParams.push(parseInt(performed_by));
    }
    if (action) {
      countSql += ' AND action = ?';
      countParams.push(action);
    }

    const countResult = query(countSql, countParams);
    const total = countResult[0]?.total || 0;

    return res.status(200).json({
      count: logs.length,
      total: total,
      limit: parsedLimit,
      offset: parsedOffset,
      audit_logs: logs
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch audit logs'
    });
  }
}

/**
 * Get audit log statistics
 * GET /api/audit/stats
 */
export function getAuditStats(req, res) {
  try {
    // Get counts by entity type
    const entityStats = query(`
      SELECT 
        entity_type,
        COUNT(*) as count
      FROM audit_logs
      GROUP BY entity_type
      ORDER BY count DESC
    `);

    // Get counts by action
    const actionStats = query(`
      SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `);

    // Get recent activity (last 24 hours)
    const recentActivity = query(`
      SELECT 
        COUNT(*) as count
      FROM audit_logs
      WHERE performed_at >= datetime('now', '-1 day')
    `);

    // Get top performers
    const topPerformers = query(`
      SELECT 
        u.login_id,
        u.name,
        al.performed_role,
        COUNT(*) as action_count
      FROM audit_logs al
      JOIN users u ON al.performed_by = u.id
      GROUP BY al.performed_by, u.login_id, u.name, al.performed_role
      ORDER BY action_count DESC
      LIMIT 10
    `);

    return res.status(200).json({
      entity_stats: entityStats,
      action_stats: actionStats,
      recent_activity_24h: recentActivity[0]?.count || 0,
      top_performers: topPerformers
    });

  } catch (error) {
    console.error('Get audit stats error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch audit statistics'
    });
  }
}

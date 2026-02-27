/**
 * Role-based access control middleware
 * Restricts access to specific user roles
 */

import { get } from '../config/database.js';

/**
 * Middleware to verify user has master_admin role
 * Blocks all other roles from accessing protected routes
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function requireMasterAdmin(req, res, next) {
  try {
    // Extract login_id from request body or query
    const loginId = req.body.loginId || req.query.loginId || req.headers['x-user-id'];

    if (!loginId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please provide login credentials.'
      });
    }

    // Fetch user from database
    const user = get('SELECT role FROM users WHERE login_id = ?', [loginId]);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid user credentials'
      });
    }

    // Check if user has master_admin role
    if (user.role !== 'master_admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. Master Admin privileges required.'
      });
    }

    // Store user info in request for downstream use
    req.user = user;
    req.loginId = loginId;

    next();
  } catch (error) {
    console.error('Role guard error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify user permissions'
    });
  }
}


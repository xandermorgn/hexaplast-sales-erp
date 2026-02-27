/**
 * Session Validation Middleware
 * Validates HTTP-only session cookies for protected routes
 */

import { validateSession } from '../utils/session.js';

// Cookie name for session token
export const SESSION_COOKIE_NAME = 'hexaplast_session';

/**
 * Middleware to validate session from HTTP-only cookie
 * Attaches user info to request if valid
 * Returns 401 if no session or invalid session
 */
export function requireSession(req, res, next) {
  try {
    // Get session token from cookie
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No session found. Please log in.',
        code: 'NO_SESSION'
      });
    }
    
    // Validate session
    const session = validateSession(token);
    
    if (!session) {
      // Clear invalid cookie
      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Session expired or invalid. Please log in again.',
        code: 'INVALID_SESSION'
      });
    }
    
    // Attach user info to request
    req.user = {
      id: session.userId,
      loginId: session.loginId,
      name: session.name,
      role: session.role
    };
    req.sessionToken = token;
    
    next();
  } catch (error) {
    console.error('Session middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate session'
    });
  }
}

/**
 * Middleware to require master_admin role (after session validation)
 * Must be used after requireSession middleware
 */
export function requireMasterAdminSession(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No session found'
    });
  }
  
  if (req.user.role !== 'master_admin' && req.user.role !== 'server_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied. Master Admin privileges required.'
    });
  }
  
  next();
}

/**
 * Middleware to require exact master_admin role (excludes server_admin)
 */
export function requireExactMasterAdminSession(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No session found'
    });
  }

  if (req.user.role !== 'master_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied. Master Admin privileges required.'
    });
  }

  next();
}

/**
 * Middleware to require server_admin role (after session validation)
 * Must be used after requireSession middleware
 */
export function requireServerAdminSession(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No session found'
    });
  }

  if (req.user.role !== 'server_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied. Server Admin privileges required.'
    });
  }

  next();
}

/**
 * Optional session validation - attaches user if valid but doesn't block
 * Useful for routes that work differently based on auth status
 */
export function optionalSession(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    
    if (token) {
      const session = validateSession(token);
      if (session) {
        req.user = {
          id: session.userId,
          loginId: session.loginId,
          name: session.name,
          role: session.role
        };
        req.sessionToken = token;
      }
    }
    
    next();
  } catch (error) {
    // Don't block on errors for optional session
    next();
  }
}

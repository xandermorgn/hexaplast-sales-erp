import { get } from '../config/database.js';
import { verifyPassword } from '../utils/hash.js';
import { createSession, destroySession, validateSession } from '../utils/session.js';
import { SESSION_COOKIE_NAME } from '../middleware/sessionMiddleware.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';

// Cookie options for session
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (was 24 hours)
  path: '/'
};

export async function login(req, res) {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Login ID and password are required'
      });
    }

    // Hard-coded Server Admin (locked)
    // Cannot be created/assigned/modified/impersonated via DB
    if (String(loginId) === 'Xander') {
      if (String(password) !== 'Xander@998877') {
        return res.status(401).json({
          success: false,
          message: 'Invalid login ID or password'
        });
      }

      const sessionToken = createSession({
        id: 0,
        login_id: 'Xander',
        name: 'Xander',
        role: 'server_admin'
      });

      res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

      return res.status(200).json({
        Login: 'Xander',
        Role: 'Server Admin'
      });
    }

    const user = get('SELECT * FROM users WHERE login_id = ?', [loginId]);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login ID or password'
      });
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid login ID or password'
      });
    }

    // Create server-side session
    const sessionToken = createSession(user);
    
    // Set HTTP-only cookie
    res.cookie(SESSION_COOKIE_NAME, sessionToken, COOKIE_OPTIONS);

    const roleMap = {
      'server_admin': 'Server Admin',
      'master_admin': 'Master Admin',
      'employee': 'Employee'
    };

    const response = {
      Login: user.login_id,
      Role: roleMap[user.role] || user.role
    };

    req.user = {
      id: user.id,
      role: user.role,
      loginId: user.login_id,
      name: user.name,
    };
    logAudit({
      entity_type: ENTITY_TYPES.USER,
      entity_id: user.id,
      action: AUDIT_ACTIONS.LOGIN,
      old_value: null,
      new_value: { login_id: user.login_id },
      req,
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
}

/**
 * Get current user info from session
 * GET /api/auth/me
 */
export function getCurrentUser(req, res) {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No session found',
        authenticated: false
      });
    }
    
    const session = validateSession(token);
    
    if (!session) {
      // Clear invalid cookie
      res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid',
        authenticated: false
      });
    }
    
    const roleMap = {
      'server_admin': 'Server Admin',
      'master_admin': 'Master Admin',
      'employee': 'Employee'
    };
    
    return res.status(200).json({
      authenticated: true,
      user: {
        loginId: session.loginId,
        name: session.name,
        role: session.role,
        roleName: roleMap[session.role] || session.role
      }
    });
    
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user info'
    });
  }
}

/**
 * Logout - destroy session and clear cookie
 * POST /api/auth/logout
 */
export function logout(req, res) {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    const session = token ? validateSession(token) : null;

    if (session && session.role !== 'server_admin') {
      req.user = {
        id: session.userId,
        role: session.role,
        loginId: session.loginId,
        name: session.name,
      };
      logAudit({
        entity_type: ENTITY_TYPES.USER,
        entity_id: session.userId,
        action: AUDIT_ACTIONS.LOGOUT,
        old_value: { login_id: session.loginId },
        new_value: null,
        req,
      });
    }
    
    if (token) {
      destroySession(token);
    }
    
    res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to logout'
    });
  }
}

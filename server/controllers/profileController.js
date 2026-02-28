/**
 * Profile Controller
 * Handles user profile customization (UI-only data)
 * Users can only edit their own profile
 * 
 * CRITICAL: Profile updates NEVER touch the employees table
 * employees = system data (Master Admin only)
 * user_profiles = UI data (user can edit)
 */

import { get, run } from '../config/database.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';

/**
 * Get current user's profile
 * GET /api/profile/me
 * 
 * Returns both system data (from employees) and UI data (from user_profiles)
 * System data is read-only for the user
 */
export function getMyProfile(req, res) {
  try {
    // req.user is set by requireSession middleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userId = req.user.id;

    // Get user profile with employee system data
    const profileQuery = `SELECT 
        up.id,
        up.user_id,
        up.display_name,
        up.personal_phone,
        up.personal_email,
        up.photo_path,
        up.created_at,
        up.updated_at,
        u.login_id,
        u.name as system_name,
        u.role,
        e.employee_id,
        e.full_name as system_full_name,
        e.contact_number as system_phone,
        e.email as system_email,
        e.designation
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE up.user_id = ?`;

    let profile = get(profileQuery, [userId]);

    // Auto-create profile shell for DB users missing user_profiles row
    if (!profile) {
      const user = get('SELECT id, name FROM users WHERE id = ?', [userId]);
      if (user) {
        run(
          `INSERT INTO user_profiles (user_id, display_name, personal_phone, personal_email, photo_path)
           VALUES (?, ?, NULL, NULL, NULL)`,
          [userId, user.name]
        );
        profile = get(profileQuery, [userId]);
      }
    }

    if (!profile) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Profile not found'
      });
    }

    return res.status(200).json({
      profile: profile
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch profile'
    });
  }
}

/**
 * Update current user's profile
 * PUT /api/profile/me
 * 
 * ONLY updates user_profiles table (UI data)
 * NEVER touches employees table (system data)
 * 
 * Editable fields:
 * - display_name
 * - personal_phone
 * - personal_email
 * 
 * photo_path is updated separately via POST /api/profile/photo
 */
export function updateMyProfile(req, res) {
  try {
    // req.user is set by requireSession middleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const userId = req.user.id;
    const { display_name, personal_phone, personal_email } = req.body;

    // Check if profile exists
    const profile = get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

    if (!profile) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Profile not found'
      });
    }

    // Build update query - ONLY for user_profiles fields
    const updates = [];
    const params = [];

    if (display_name !== undefined) {
      if (!display_name || display_name.trim() === '') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Display name cannot be empty'
        });
      }
      updates.push('display_name = ?');
      params.push(display_name.trim());
    }

    if (personal_phone !== undefined) {
      updates.push('personal_phone = ?');
      params.push(personal_phone || null);
    }

    if (personal_email !== undefined) {
      updates.push('personal_email = ?');
      params.push(personal_email || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No fields to update'
      });
    }

    // Add updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    // Update ONLY user_profiles table - NEVER employees
    run(
      `UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = ?`,
      params
    );

    // Fetch updated profile with system data
    const updated = get(
      `SELECT 
        up.id,
        up.user_id,
        up.display_name,
        up.personal_phone,
        up.personal_email,
        up.photo_path,
        up.created_at,
        up.updated_at,
        u.login_id,
        u.name as system_name,
        u.role,
        e.employee_id,
        e.full_name as system_full_name,
        e.contact_number as system_phone,
        e.email as system_email
      FROM user_profiles up
      JOIN users u ON up.user_id = u.id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE up.user_id = ?`,
      [userId]
    );

    // Audit log
    logAudit({
      entity_type: ENTITY_TYPES.PROFILE,
      entity_id: profile.id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: profile,
      new_value: updated,
      req
    });

    return res.status(200).json({
      message: 'Profile updated successfully',
      profile: updated
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update profile'
    });
  }
}

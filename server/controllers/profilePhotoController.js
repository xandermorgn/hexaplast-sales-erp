/**
 * Profile Photo Controller
 * Handles profile photo upload and management
 * Photos are stored as BLOBs directly in the database (user_profiles.photo_data)
 * This ensures photos persist across restarts, deploys, and rebuilds.
 */

import { get, run } from '../config/database.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Upload profile photo (base64 JSON body)
 * POST /api/profile/photo
 * 
 * Body: { photo_base64: "data:image/jpeg;base64,/9j/..." }
 * Stores the raw binary in user_profiles.photo_data
 */
export function uploadPhoto(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    }

    const { photo_base64 } = req.body;
    if (!photo_base64 || typeof photo_base64 !== 'string') {
      return res.status(400).json({ error: 'No photo', message: 'No photo data provided' });
    }

    // Parse data URI: data:image/jpeg;base64,/9j/4AAQ...
    const match = photo_base64.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Invalid format', message: 'Photo must be a base64 data URI' });
    }

    const mime = match[1].toLowerCase();
    const base64Data = match[2];

    if (!ALLOWED_MIMES.includes(mime)) {
      return res.status(400).json({ error: 'Invalid type', message: 'Only JPG, PNG and WebP are allowed' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_PHOTO_SIZE) {
      return res.status(400).json({ error: 'File too large', message: 'Profile photo must be less than 5MB' });
    }

    // Get old profile for audit
    const oldProfile = get('SELECT id, photo_mime FROM user_profiles WHERE user_id = ?', [userId]);

    // Store binary data + mime type in DB
    run(
      `UPDATE user_profiles 
       SET photo_data = ?, photo_mime = ?, photo_path = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [buffer, mime, userId]
    );

    // Audit log
    if (oldProfile) {
      logAudit({
        entity_type: ENTITY_TYPES.PROFILE,
        entity_id: oldProfile.id,
        action: AUDIT_ACTIONS.UPDATE,
        old_value: { photo: oldProfile.photo_mime ? 'had photo' : 'no photo' },
        new_value: { photo: mime },
        req
      });
    }

    return res.status(200).json({
      message: 'Photo uploaded successfully',
      photo_mime: mime
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to save photo' });
  }
}

/**
 * Delete profile photo
 * DELETE /api/profile/photo
 * 
 * Clears photo_data and photo_mime in DB
 */
export function deletePhoto(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    }

    const profile = get('SELECT id, photo_data FROM user_profiles WHERE user_id = ?', [userId]);
    if (!profile) {
      return res.status(404).json({ error: 'Not found', message: 'Profile not found' });
    }

    if (!profile.photo_data) {
      return res.status(400).json({ error: 'No photo', message: 'No profile photo to delete' });
    }

    run(
      `UPDATE user_profiles 
       SET photo_data = NULL, photo_mime = NULL, photo_path = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [userId]
    );

    logAudit({
      entity_type: ENTITY_TYPES.PROFILE,
      entity_id: profile.id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: { photo: 'had photo' },
      new_value: { photo: null },
      req
    });

    return res.status(200).json({ message: 'Photo deleted successfully' });

  } catch (error) {
    console.error('Delete photo error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete photo' });
  }
}

/**
 * Get profile photo as binary image
 * GET /api/profile/photo?user_id=<id>
 * 
 * Returns the raw image bytes with proper Content-Type header
 * If no user_id param, returns the current user's photo
 */
export function getPhoto(req, res) {
  try {
    const targetUserId = req.query?.user_id || req.user?.id;
    if (!targetUserId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
    }

    const profile = get(
      'SELECT photo_data, photo_mime FROM user_profiles WHERE user_id = ?',
      [targetUserId]
    );

    if (!profile || !profile.photo_data) {
      return res.status(404).json({ error: 'Not found', message: 'No photo found' });
    }

    // Return as base64 data URI for JSON consumption
    const base64 = Buffer.from(profile.photo_data).toString('base64');
    return res.status(200).json({
      photo_data_uri: `data:${profile.photo_mime || 'image/jpeg'};base64,${base64}`
    });

  } catch (error) {
    console.error('Get photo error:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to get photo' });
  }
}

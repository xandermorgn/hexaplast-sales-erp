/**
 * Profile Photo Controller
 * Handles profile photo upload and management
 * Photos are stored on disk, path saved in user_profiles.photo_path
 */

import { get, run } from '../config/database.js';
import { logAudit, AUDIT_ACTIONS, ENTITY_TYPES } from '../utils/auditLogger.js';
import { uploadProfilePhoto, getProfilePhotoPath, deleteOldProfilePhoto } from '../middleware/uploadMiddleware.js';

/**
 * Upload profile photo
 * POST /api/profile/photo
 * 
 * Accepts multipart/form-data with 'photo' field
 * Overwrites previous photo for the user
 * Saves file to disk, stores path in DB
 */
export function uploadPhoto(req, res) {
  // Delete old photos first (to handle extension changes)
  if (req.user?.id) {
    deleteOldProfilePhoto(req.user.id);
  }

  uploadProfilePhoto(req, res, function (err) {
    if (err) {
      console.error('Upload error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          message: 'Profile photo must be less than 5MB'
        });
      }
      
      return res.status(400).json({
        error: 'Upload failed',
        message: err.message || 'Failed to upload photo'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No file',
        message: 'No photo file provided'
      });
    }

    try {
      const userId = req.user.id;
      const photoPath = getProfilePhotoPath(req.file.filename);

      // Get old profile for audit
      const oldProfile = get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

      // Update photo_path in user_profiles
      run(
        'UPDATE user_profiles SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [photoPath, userId]
      );

      // Get updated profile
      const updatedProfile = get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

      // Audit log
      if (oldProfile) {
        logAudit({
          entity_type: ENTITY_TYPES.PROFILE,
          entity_id: oldProfile.id,
          action: AUDIT_ACTIONS.UPDATE,
          old_value: { photo_path: oldProfile.photo_path },
          new_value: { photo_path: photoPath },
          req
        });
      }

      return res.status(200).json({
        message: 'Photo uploaded successfully',
        photo_path: photoPath
      });

    } catch (error) {
      console.error('Save photo path error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to save photo'
      });
    }
  });
}

/**
 * Delete profile photo
 * DELETE /api/profile/photo
 * 
 * Removes photo from disk and clears photo_path in DB
 */
export function deletePhoto(req, res) {
  try {
    const userId = req.user.id;

    // Get current profile
    const profile = get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

    if (!profile) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Profile not found'
      });
    }

    if (!profile.photo_path) {
      return res.status(400).json({
        error: 'No photo',
        message: 'No profile photo to delete'
      });
    }

    // Delete file from disk
    deleteOldProfilePhoto(userId);

    // Clear photo_path in DB
    run(
      'UPDATE user_profiles SET photo_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [userId]
    );

    // Audit log
    logAudit({
      entity_type: ENTITY_TYPES.PROFILE,
      entity_id: profile.id,
      action: AUDIT_ACTIONS.UPDATE,
      old_value: { photo_path: profile.photo_path },
      new_value: { photo_path: null },
      req
    });

    return res.status(200).json({
      message: 'Photo deleted successfully'
    });

  } catch (error) {
    console.error('Delete photo error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete photo'
    });
  }
}

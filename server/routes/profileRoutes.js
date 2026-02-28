/**
 * Profile Routes
 * REST API endpoints for user profile management
 * Session validation enforced
 * 
 * Profile data is separate from employee system data:
 * - user_profiles = UI data (user can edit)
 * - employees = system data (Master Admin only)
 */

import express from 'express';
import { requireSession } from '../middleware/sessionMiddleware.js';
import { getMyProfile, updateMyProfile } from '../controllers/profileController.js';
import { uploadPhoto, deletePhoto } from '../controllers/profilePhotoController.js';

const router = express.Router();

// Apply session validation to all routes
router.use(requireSession);

/**
 * GET /api/profile/me
 * Get current user's profile (UI data + read-only system data)
 */
router.get('/me', getMyProfile);

/**
 * PUT /api/profile/me
 * Update current user's profile (display_name, personal_phone, personal_email)
 * NEVER touches employees table
 */
router.put('/me', updateMyProfile);

/**
 * POST /api/profile/photo
 * Upload profile photo (multipart/form-data, field: 'photo')
 * Stores on disk, saves path in DB
 */
router.post('/photo', uploadPhoto);

/**
 * DELETE /api/profile/photo
 * Delete profile photo from disk and DB
 */
router.delete('/photo', deletePhoto);

export default router;

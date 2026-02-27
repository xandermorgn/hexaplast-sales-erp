/**
 * Upload Middleware
 * Handles file uploads using multer
 * Stores files on disk in /backend/uploads/
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base upload directory
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PROFILE_PHOTOS_DIR = path.join(UPLOADS_DIR, 'profile_photos');

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROFILE_PHOTOS_DIR)) {
    fs.mkdirSync(PROFILE_PHOTOS_DIR, { recursive: true });
  }
}

ensureDirectories();

// Allowed file types for profile photos
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Storage configuration for profile photos
const profilePhotoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureDirectories();
    cb(null, PROFILE_PHOTOS_DIR);
  },
  filename: function (req, file, cb) {
    // Use user ID from session to name the file
    // This ensures each user has only one photo (overwrites previous)
    const userId = req.user?.id;
    if (!userId) {
      return cb(new Error('User not authenticated'));
    }
    
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `user_${userId}${ext}`;
    cb(null, filename);
  }
});

// File filter for profile photos
const profilePhotoFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
  }
};

// Multer instance for profile photos
export const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  fileFilter: profilePhotoFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
}).single('photo');

// Helper to get the relative path for storage in DB
export function getProfilePhotoPath(filename) {
  return `/uploads/profile_photos/${filename}`;
}

// Helper to delete old profile photo
export function deleteOldProfilePhoto(userId) {
  const extensions = ['.jpg', '.jpeg', '.png'];
  for (const ext of extensions) {
    const filePath = path.join(PROFILE_PHOTOS_DIR, `user_${userId}${ext}`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to delete old photo:', err);
      }
    }
  }
}

export { UPLOADS_DIR, PROFILE_PHOTOS_DIR };

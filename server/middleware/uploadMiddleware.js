/**
 * Upload Middleware
 * Handles file uploads using multer
 * Stores files on disk in /backend/uploads/
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

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

// Memory storage so we can run sharp before writing to disk
const profilePhotoMemStorage = multer.memoryStorage();

// File filter for profile photos
const profilePhotoFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
  }
};

// Multer instance for profile photos (memory buffer)
const uploadProfilePhotoRaw = multer({
  storage: profilePhotoMemStorage,
  fileFilter: profilePhotoFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
}).single('photo');

/**
 * Process uploaded profile photo through sharp:
 * - Resize to max 512px (inside fit, maintain aspect ratio)
 * - Convert to JPEG quality 90
 * - Write to disk
 * Sets req.file.filename after processing.
 */
export function uploadProfilePhoto(req, res, callback) {
  uploadProfilePhotoRaw(req, res, async function (err) {
    if (err) return callback(err);
    if (!req.file) return callback(null); // no file provided

    try {
      ensureDirectories();
      const userId = req.user?.id;
      if (!userId) return callback(new Error('User not authenticated'));

      const filename = `user_${userId}.jpg`;
      const outputPath = path.join(PROFILE_PHOTOS_DIR, filename);

      await sharp(req.file.buffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toFile(outputPath);

      // Patch req.file so downstream code sees the saved file
      req.file.filename = filename;
      req.file.path = outputPath;

      callback(null);
    } catch (sharpErr) {
      console.error('Sharp processing error:', sharpErr);
      callback(new Error('Failed to process image'));
    }
  });
}

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

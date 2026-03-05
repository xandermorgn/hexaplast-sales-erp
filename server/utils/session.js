/**
 * Session Management Module
 * Handles server-side session storage and validation
 * Persists sessions to disk to survive server restarts
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_FILE_PATH = path.join(__dirname, '..', 'data', 'sales_sessions.json');

// In-memory session store (loaded from disk on startup)
// Format: { sessionToken: { userId, loginId, role, createdAt, expiresAt } }
let sessions = new Map();

// Session configuration
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (was 24 hours)

/**
 * Load sessions from disk on startup
 */
function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      const data = fs.readFileSync(SESSION_FILE_PATH, 'utf8');
      const sessionsObj = JSON.parse(data);
      sessions = new Map(Object.entries(sessionsObj));
      console.log(`Loaded ${sessions.size} sessions from disk`);
    }
  } catch (error) {
    console.error('Error loading sessions:', error.message);
    sessions = new Map();
  }
}

/**
 * Save sessions to disk
 */
function saveSessions() {
  try {
    const dir = path.dirname(SESSION_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const sessionsObj = Object.fromEntries(sessions);
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(sessionsObj, null, 2));
  } catch (error) {
    console.error('Error saving sessions:', error.message);
  }
}

// Load sessions on module initialization
loadSessions();

/**
 * Generate a cryptographically secure session token
 * @returns {string} 64-character hex token
 */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session for a user
 * @param {Object} user - User object from database
 * @returns {string} Session token
 */
export function createSession(user) {
  const token = generateSessionToken();
  const now = Date.now();
  
  sessions.set(token, {
    userId: user.id,
    loginId: user.login_id,
    name: user.name,
    role: user.role,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  });
  
  // Persist to disk
  saveSessions();
  
  return token;
}

/**
 * Validate a session token and return session data
 * @param {string} token - Session token to validate
 * @returns {Object|null} Session data if valid, null if invalid/expired
 */
export function validateSession(token) {
  if (!token) return null;
  
  let session = sessions.get(token);

  // If not found in memory, reload from disk (handles cross-worker sessions)
  if (!session) {
    loadSessions();
    session = sessions.get(token);
  }

  if (!session) return null;
  
  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  
  return session;
}

/**
 * Destroy a session (logout)
 * @param {string} token - Session token to destroy
 * @returns {boolean} True if session was destroyed
 */
export function destroySession(token) {
  const result = sessions.delete(token);
  // Persist to disk
  saveSessions();
  return result;
}

/**
 * Clean up expired sessions (call periodically)
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = false;
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
      cleaned = true;
    }
  }
  // Save if any sessions were cleaned
  if (cleaned) {
    saveSessions();
  }
}

/**
 * Get all active sessions (for debugging/admin)
 * @returns {number} Count of active sessions
 */
export function getActiveSessionCount() {
  cleanupExpiredSessions();
  return sessions.size;
}

// Clean up expired sessions every 15 minutes
setInterval(cleanupExpiredSessions, 15 * 60 * 1000);

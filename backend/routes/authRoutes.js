import express from 'express';
import { login, getCurrentUser, logout } from '../controllers/authController.js';

const router = express.Router();

// Login - creates session and sets HTTP-only cookie
router.post('/login', login);

// Get current user info from session
router.get('/me', getCurrentUser);

// Logout - destroys session and clears cookie
router.post('/logout', logout);

export default router;

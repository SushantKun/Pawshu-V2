/**
 * Auth Routes
 * 
 * Defines API endpoints for user authentication including registration, login,
 * and profile management.
 */

import express from 'express';
import { verifyToken } from '../middleware/auth';
import {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserProfile
} from '../controllers/authController';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/me', verifyToken, getCurrentUser);
router.put('/profile', verifyToken, updateUserProfile);

export default router; 
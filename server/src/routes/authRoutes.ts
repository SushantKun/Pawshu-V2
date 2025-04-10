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
import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../types/auth';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/me', verifyToken, getCurrentUser);
router.put('/profile', verifyToken, updateUserProfile);

router.get('/profile', verifyToken as any, async (req: AuthRequest, res: Response) => {
  try {
    // Use the authenticated user from the token
    const user = req.user;
    
    // If no user in token, return error
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Find the user to get up-to-date information including avatar
    const User = mongoose.model('User');
    const updatedUser = await User.findById(user._id)
      .select('-password -resetToken -resetTokenExpiry');
    
    // If user no longer exists in database
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile by ID (useful for chat avatars, user cards, etc.)
router.get('/users/:userId', verifyToken as any, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const { userId } = req.params;
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Find the requested user, omitting sensitive fields
    const User = mongoose.model('User');
    const user = await User.findById(userId)
      .select('firstName lastName email avatar name role');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 
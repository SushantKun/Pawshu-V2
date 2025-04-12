/**
 * User Routes
 * 
 * Defines API endpoints for user-related functionality including
 * profile viewing, online status, and other user operations.
 */

import express, { Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import mongoose from 'mongoose';

const router = express.Router();
const User = mongoose.model('User');

// Get user online status
router.get('/:id/online-status', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is online or active in the last 5 minutes
    const isRecentlyActive = user.lastActive && 
      (new Date().getTime() - new Date(user.lastActive).getTime() < 5 * 60 * 1000);
    
    const isOnline = user.isOnline || isRecentlyActive;
    
    res.json({ isOnline, lastActive: user.lastActive });
  } catch (error) {
    console.error('Error getting user online status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 
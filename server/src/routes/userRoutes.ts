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
import User from '../models/User';

const router = express.Router();

// Get user profile
router.get('/:id/profile', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user online status
router.get('/:id/online-status', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    console.log(`Checking online status for user ID: ${userId}`);
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log(`Invalid user ID format: ${userId}`);
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Use a direct database connection for the most up-to-date data
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    
    if (!user) {
      console.log(`User not found with ID: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // MORE LENIENT: Increase threshold for determining if a user is still online
    // This helps prevent flashing between online/offline states
    const ONLINE_THRESHOLD_MS = 30000; // 30 seconds (increased from 15)
    
    // Check if lastActive is recent enough to consider user online
    const now = new Date();
    const lastActive = user.lastActive ? new Date(user.lastActive) : null;
    const timeSinceLastActive = lastActive ? now.getTime() - lastActive.getTime() : Infinity;
    
    // IMPROVED DETECTION: User is considered online if:
    // 1. They have an isOnline flag set to true OR
    // 2. Their lastActive timestamp is within the threshold
    // This way, even if the isOnline flag wasn't set correctly, we'll still show as online
    // if they've been active recently
    const isOnline = user.isOnline === true || (lastActive && timeSinceLastActive < ONLINE_THRESHOLD_MS);
    
    // Log detailed debug info to help troubleshoot
    console.log(`Online status for ${userId}:`, {
      isOnline,
      isOnlineFlag: user.isOnline,
      lastActiveTime: lastActive,
      timeSinceLastActive: lastActive ? `${Math.floor(timeSinceLastActive / 1000)}s ago` : 'never',
      threshold: `${ONLINE_THRESHOLD_MS / 1000}s`
    });
    
    res.json({ 
      isOnline, 
      lastActive: user.lastActive || null,
      // Include additional debug info to help troubleshoot
      debug: {
        timeNow: now,
        timeSinceLastActive: timeSinceLastActive,
        threshold: ONLINE_THRESHOLD_MS,
        isOnlineFlag: user.isOnline,
        lastOnlineTime: lastActive
      }
    });
  } catch (error) {
    console.error('Error getting user online status:', error, 'Stack:', error instanceof Error ? error.stack : '');
    res.status(500).json({ message: 'Server error' });
  }
});

// Add additional route that uses 'userId' as the parameter name (for compatibility with frontend)
router.get('/:userId/online-status', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    console.log(`Checking online status for user ID (userId param): ${userId}`);
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log(`Invalid user ID format: ${userId}`);
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Use a direct database connection for the most up-to-date data
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    
    if (!user) {
      console.log(`User not found with ID: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // MORE LENIENT: Increase threshold for determining if a user is still online
    // This helps prevent flashing between online/offline states
    const ONLINE_THRESHOLD_MS = 30000; // 30 seconds (increased from 15)
    
    // Check if lastActive is recent enough to consider user online
    const now = new Date();
    const lastActive = user.lastActive ? new Date(user.lastActive) : null;
    const timeSinceLastActive = lastActive ? now.getTime() - lastActive.getTime() : Infinity;
    
    // IMPROVED DETECTION: User is considered online if:
    // 1. They have an isOnline flag set to true OR
    // 2. Their lastActive timestamp is within the threshold
    // This way, even if the isOnline flag wasn't set correctly, we'll still show as online
    // if they've been active recently
    const isOnline = user.isOnline === true || (lastActive && timeSinceLastActive < ONLINE_THRESHOLD_MS);
    
    // Log detailed debug info to help troubleshoot
    console.log(`Online status for ${userId}:`, {
      isOnline,
      isOnlineFlag: user.isOnline,
      lastActiveTime: lastActive,
      timeSinceLastActive: lastActive ? `${Math.floor(timeSinceLastActive / 1000)}s ago` : 'never',
      threshold: `${ONLINE_THRESHOLD_MS / 1000}s`
    });
    
    res.json({ 
      isOnline, 
      lastActive: user.lastActive || null,
      // Include additional debug info to help troubleshoot
      debug: {
        timeNow: now,
        timeSinceLastActive: timeSinceLastActive,
        threshold: ONLINE_THRESHOLD_MS,
        isOnlineFlag: user.isOnline,
        lastOnlineTime: lastActive
      }
    });
  } catch (error) {
    console.error('Error getting user online status:', error, 'Stack:', error instanceof Error ? error.stack : '');
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a debug endpoint to check user online status with detailed information
router.get('/:id/online-status-debug', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findById(userId).select('isOnline lastActive uniqueSessionId lastStatusUpdate');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get socket connection information
    const io = req.app.get('io');
    const sockets = await io.fetchSockets();
    const connectedSockets = sockets.filter(s => s.data.userId === userId);
    
    // Calculate time since last active
    const now = new Date();
    const lastActive = user.lastActive ? new Date(user.lastActive) : null;
    const timeSinceLastActive = lastActive ? now.getTime() - lastActive.getTime() : null;
    
    // Check if any socket is connected for this user
    const isConnectedViaSocket = connectedSockets.length > 0;
    
    // Send detailed response with debug info
    res.json({
      userId,
      isOnline: user.isOnline,
      lastActive: user.lastActive,
      debug: {
        socketCount: connectedSockets.length,
        socketIds: connectedSockets.map(s => s.id),
        sessionId: user.uniqueSessionId,
        lastStatusUpdate: user.lastStatusUpdate,
        timeSinceLastActive: timeSinceLastActive ? `${Math.round(timeSinceLastActive / 1000)}s ago` : null,
        isConnectedViaSocket,
        activeConnections: sockets.length
      }
    });
  } catch (error) {
    console.error('Error getting detailed user online status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 
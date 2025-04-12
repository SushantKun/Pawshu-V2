/**
 * Auth Controller
 * 
 * Handles user authentication including registration, login, and password reset.
 */

import { Request, Response } from 'express';
import User from '../models/User';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../types/auth';
import { OAuth2Client } from 'google-auth-library';
import mongoose from 'mongoose';

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Register a new user
 * @route POST /api/auth/register
 */
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password
    });

    // Save user to database (password will be hashed by the pre-save hook)
    await newUser.save();

    // Create JWT token
    const token = jwt.sign(
      {
        _id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: 'user'
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    // Return token and user info (excluding password)
    const userResponse = newUser.toObject();
    const { password: _, ...userWithoutPassword } = userResponse;

    res.status(201).json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Login a user
 * @route POST /api/auth/login
 */
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update online status to true
    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      {
        _id: user._id,
        id: user._id, // Add id field for compatibility
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: rememberMe ? '30d' : '7d' }
    );

    // Return token and user info (excluding password)
    const userResponse = user.toObject();
    const { password: _, ...userWithoutPassword } = userResponse;

    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/me
 */
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update user profile
 * @route PUT /api/auth/profile
 */
export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user fields
    const { firstName, lastName, address, phone } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (address) user.address = address;
    if (phone) user.phone = phone;

    // Save updated user
    await user.save();

    // Return updated user (excluding password)
    const updatedUser = await User.findById(req.user._id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update user password
 * @route PUT /api/auth/profile/password
 */
export const updateUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { currentPassword, newPassword } = req.body;

    // Find user with password field
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has a Google account
    const isGoogleUser = !!user.googleId;

    // Validate input based on user type
    if (isGoogleUser) {
      // For Google users, only require the new password
      if (!newPassword) {
        return res.status(400).json({ message: 'New password is required' });
      }
    } else {
      // For regular users, require both current and new passwords
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }

      // Verify current password for regular users
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    // Check if the new password meets minimum requirements
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Return appropriate success message
    const successMessage = isGoogleUser && !user.password
      ? 'Password set successfully'
      : 'Password updated successfully';

    res.status(200).json({ message: successMessage });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Google Authentication
 * @route POST /api/auth/google
 */
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { token, rememberMe = false } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Google token is required' });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Invalid Google token' });
    }

    const { email, name, picture, sub } = payload;
    const firstName = payload.given_name || name?.split(' ')[0] || '';
    const lastName = payload.family_name || name?.split(' ').slice(1).join(' ') || '';

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = new User({
        email,
        firstName,
        lastName,
        googleId: sub,
        isEmailVerified: true, // Email is verified by Google
        status: 'active',
        avatar: {
          url: picture || ''
        }
      });
      await user.save();
      console.log('New Google user created:', user._id);
    } else if (!user.googleId) {
      // Link Google account to existing user
      user.googleId = sub;
      user.isEmailVerified = true;

      // Update profile picture if it's from Google and user doesn't have one
      if (picture && (!user.avatar?.url || user.avatar.url === '')) {
        user.avatar = user.avatar || {};
        user.avatar.url = picture;
      }

      await user.save();
      console.log('Google account linked to existing user:', user._id);
    }

    // Generate JWT
    const userToken = jwt.sign(
      {
        _id: user._id,
        id: user._id, // Add id field for compatibility
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: rememberMe ? '30d' : '7d' }
    );

    // Return token and user info
    res.status(200).json({
      token: userToken,
      user
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    res.status(500).json({
      message: 'Google authentication failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Refresh authentication token
 * @route POST /api/auth/refresh-token
 */
export const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    // The verifyToken middleware has already verified the token
    // and attached the user data to the request
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Get the latest user data from the database
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a new token with fresh expiration
    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '60d' } // Set a long expiration for the refreshed token
    );

    // Return the new token
    res.json({ token, message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      message: 'Failed to refresh token',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Set user as offline
 * @route POST /api/auth/set-offline
 */
export const setUserOffline = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // If the request doesn't have a user object, use the userId from the body
    const userIdToUpdate = req.user?._id || userId;

    // Update user's online status to false
    const updatedUser = await User.findByIdAndUpdate(userIdToUpdate, {
      isOnline: false,
      lastActive: new Date()
    }, { new: true });

    if (!updatedUser) {
      console.log(`User ${userIdToUpdate} not found when trying to set offline`);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`User ${userIdToUpdate} (${updatedUser.email}) has been marked as offline`);

    res.status(200).json({ message: 'User set as offline successfully' });
  } catch (error) {
    console.error('Error setting user offline:', error);
    res.status(500).json({
      message: 'Failed to set user as offline',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 */
export const logoutUser = async (req: AuthRequest, res: Response) => {
  try {
    // Check if user exists in request (from auth middleware)
    if (!req.user || !req.user._id) {
      // Try to get from request body instead
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      // Mark user as offline
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastActive: new Date()
      });
      
      console.log(`User ${userId} has been logged out and marked as offline`);
    } else {
      // Mark authenticated user as offline
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastActive: new Date()
      });
      
      console.log(`User ${req.user._id} (${req.user.email}) has been logged out and marked as offline`);
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({
      message: 'Failed to logout',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Send ping to update user's last active time
 * This is the critical keepalive function that maintains online status
 * @route POST /api/auth/ping
 */
export const pingUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Get the current date/time
    const now = new Date();
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Use direct database access for maximum performance
    // This needs to be as fast as possible since it's called frequently
    await mongoose.connection.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { lastActive: now } }
    );
    
    // Only log once per minute to reduce log spam
    if (now.getSeconds() < 5) {
      console.log(`Ping received for user ${userId}, updated lastActive at ${now.toISOString()}`);
    }

    // Send minimal response
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating ping status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Handle beacon signals when browser is closed
 * @route POST /api/auth/set-offline-beacon
 */
export const handleBeacon = async (req: Request, res: Response) => {
  try {
    console.log('Received beacon request to set user offline');
    console.log('Beacon request body type:', typeof req.body);
    console.log('Beacon request content-type:', req.headers['content-type']);
    
    // For debugging
    if (typeof req.body !== 'object' || !req.body) {
      console.log('Raw beacon body content:', req.body);
    }
    
    // For beacon requests, we need to handle different body formats
    let userId: string | undefined;
    
    if (Buffer.isBuffer(req.body)) {
      // Handle raw Buffer from express.raw middleware
      try {
        const rawBody = req.body.toString('utf8');
        console.log('Buffer content converted to string:', rawBody);
        const parsedBody = JSON.parse(rawBody);
        userId = parsedBody.userId;
        console.log('Extracted userId from buffer:', userId);
      } catch (parseError) {
        console.error('Error parsing buffer beacon body:', parseError);
      }
    } else if (typeof req.body === 'string') {
      // Handle string body
      try {
        console.log('String body content:', req.body);
        const parsedBody = JSON.parse(req.body);
        userId = parsedBody.userId;
        console.log('Extracted userId from string:', userId);
      } catch (parseError) {
        console.error('Error parsing string beacon body:', parseError);
      }
    } else if (req.body && typeof req.body === 'object') {
      // Handle object body (already parsed by bodyParser)
      userId = req.body.userId;
      console.log('Extracted userId from object:', userId);
    }
    
    if (!userId) {
      console.error('Missing userId in beacon request. Body:', req.body);
      return res.status(200).end(); // Always return 200 for beacon calls
    }
    
    console.log(`Processing beacon request to set user ${userId} as offline`);
    
    // Update user's online status to false
    const result = await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastActive: new Date()
    }, { new: true });
    
    if (result) {
      console.log(`User ${userId} (${result.email}) has been marked as offline via beacon`);
    } else {
      console.warn(`User ${userId} not found when processing beacon request`);
    }
    
    // Always return 200 for beacon calls
    res.status(200).end();
  } catch (error) {
    console.error('Error handling beacon:', error);
    // Always return 200 for beacon calls even on error
    res.status(200).end();
  }
};

/**
 * Handle browser close event with highest priority
 * This is a critical endpoint for detecting when users close their browsers
 * @route POST /api/auth/browser-closed
 */
export const handleBrowserClose = async (req: Request, res: Response) => {
  try {
    // Extract user ID from request
    const { userId } = req.body;
    
    if (!userId) {
      console.error('Missing userId in browser close request');
      return res.status(200).end(); // Always return 200 for browser close events
    }
    
    console.log(`BROWSER CLOSED: Processing critical update for user ${userId}`);
    
    // CRITICAL FIX: Use a more direct database approach
    try {
      // Directly update the user's status
      const db = mongoose.connection.db;
      const result = await db.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { 
          $set: { 
            isOnline: false,
            lastActive: new Date()
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`BROWSER CLOSED: Successfully marked user ${userId} as OFFLINE`);
      } else {
        console.log(`BROWSER CLOSED: User ${userId} not found or already offline`);
      }
    } catch (dbError) {
      console.error(`DATABASE ERROR during browser close for user ${userId}:`, dbError);
    }
    
    // Always return 200 for browser close calls
    res.status(200).end();
  } catch (error) {
    console.error('Error handling browser close:', error);
    // Always return 200 for browser close calls even on error
    res.status(200).end();
  }
}; 
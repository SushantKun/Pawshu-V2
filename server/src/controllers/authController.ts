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
import { v2 as cloudinary } from 'cloudinary';

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Generate a unique session ID
 * This helps track which login session is currently active
 */
const generateSessionId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 15);
};

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

    // Generate a unique session ID for this login
    const sessionId = generateSessionId();

    // Update online status to true and set lastAuthMethod
    user.isOnline = true;
    user.lastActive = new Date();
    user.lastAuthMethod = 'password'; // Track that this login was via password
    user.uniqueSessionId = sessionId; // Set the unique session ID
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      {
        _id: user._id,
        id: user._id, // Add id field for compatibility
        email: user.email,
        role: user.role,
        authMethod: 'password', // Add authMethod to token
        sessionId: sessionId // Add sessionId to token for verification
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
    console.log('Update profile request:', req.body);
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user fields
    const { firstName, lastName, address, phone, avatar } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (address) user.address = address;
    if (phone) user.phone = phone;
    
    // Handle avatar update
    if (avatar && typeof avatar === 'object') {
      console.log('Updating avatar with:', avatar);
      
      // Store previous avatar info for cleanup
      const oldAvatarId = user.avatar?.public_id;
      
      // Update the avatar
      user.avatar = avatar;
      
      // If the user logged in with Google but is updating their avatar,
      // we don't want to remove their ability to log in with Google
      if (user.googleId) {
        console.log('Preserving Google ID for user with avatar update:', user.googleId);
        // We're just updating avatar, not removing Google connection
      }
      
      // If old avatar was from Cloudinary (not Google hosted), delete it
      if (oldAvatarId && 
          !oldAvatarId.includes('google_') && 
          oldAvatarId !== avatar.public_id) {
        try {
          console.log('Deleting old avatar from Cloudinary:', oldAvatarId);
          await cloudinary.uploader.destroy(oldAvatarId);
        } catch (deleteError) {
          console.error('Error deleting old avatar:', deleteError);
          // Non-blocking error, continue with update
        }
      }
    }

    // Save updated user
    await user.save();
    
    console.log('User profile updated successfully:', user._id);

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

    console.log('Google auth payload picture URL:', picture);

    // Generate a unique session ID for this login
    const sessionId = generateSessionId();

    // Check if another user with the same email is already online
    // If so, mark them as offline to prevent duplicate online status
    await User.updateMany(
      { email, isOnline: true },
      { 
        $set: { 
          isOnline: false,
          lastActive: new Date()
        } 
      }
    );

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user with Google profile picture
      let avatarObj = {};
      
      // If picture URL exists from Google, try to store it
      if (picture) {
        try {
          // Try to download the image from Google to our Cloudinary account
          console.log('Attempting to upload Google profile picture to Cloudinary');
          const cloudinaryUpload = await cloudinary.uploader.upload(picture, {
            folder: 'pawshu/users',
            public_id: `google_${sub}`,
            overwrite: true
          });
          
          console.log('Successfully uploaded Google profile picture to Cloudinary:', cloudinaryUpload.secure_url);
          
          // Use our Cloudinary hosted version of the profile picture
          avatarObj = {
            public_id: cloudinaryUpload.public_id,
            url: cloudinaryUpload.secure_url
          };
        } catch (uploadError) {
          console.error('Failed to upload Google profile picture to Cloudinary:', uploadError);
          
          // Fall back to direct Google URL if Cloudinary upload fails
          avatarObj = {
            public_id: `google_${sub}`,
            url: picture
          };
        }
      }
      
      user = new User({
        email,
        firstName,
        lastName,
        googleId: sub,
        isEmailVerified: true,
        status: 'active',
        avatar: avatarObj,
        isOnline: true,            // CRITICAL: Explicitly set isOnline to true for new Google users
        lastActive: new Date(),    // CRITICAL: Set lastActive timestamp for new Google users
        lastAuthMethod: 'google',   // Track that this user last logged in via Google
        uniqueSessionId: sessionId  // Set unique session ID
      });
      
      await user.save();
      console.log('New Google user created with avatar:', user.avatar);
    } else {
      // Update last auth method to recognize this user came from Google OAuth
      user.lastAuthMethod = 'google';
      
      if (!user.googleId) {
        // Link Google account to existing user
        user.googleId = sub;
        user.isEmailVerified = true;
        
        // Only update picture if user doesn't have one already
        if (picture && (!user.avatar?.url || user.avatar.url === '')) {
          try {
            // Try to download the image from Google to our Cloudinary account
            console.log('Attempting to upload Google profile picture to Cloudinary for existing user');
            const cloudinaryUpload = await cloudinary.uploader.upload(picture, {
              folder: 'pawshu/users',
              public_id: `google_${sub}`,
              overwrite: true
            });
            
            console.log('Successfully uploaded Google profile picture to Cloudinary:', cloudinaryUpload.secure_url);
            
            // Use our Cloudinary hosted version of the profile picture
            user.avatar = {
              public_id: cloudinaryUpload.public_id,
              url: cloudinaryUpload.secure_url
            };
          } catch (uploadError) {
            console.error('Failed to upload Google profile picture to Cloudinary:', uploadError);
            
            // Fall back to direct Google URL if Cloudinary upload fails
            user.avatar = {
              public_id: `google_${sub}`,
              url: picture
            };
          }
        }
        
        console.log('Google account linked to existing user:', user._id);
      } else {
        console.log(`Existing Google user ${user._id} logged in, marked as online`);
      }
      
      // CRITICAL: Update online status for existing users using Google auth
      user.isOnline = true;
      user.lastActive = new Date();
      user.uniqueSessionId = sessionId;
      await user.save();
    }

    // Generate JWT
    const userToken = jwt.sign(
      {
        _id: user._id,
        id: user._id, // Add id field for compatibility
        email: user.email,
        role: user.role,
        authMethod: 'google', // Add authMethod to token for tracking
        sessionId: sessionId // Add sessionId to token for verification
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: rememberMe ? '30d' : '7d' }
    );
    
    console.log(`Google user ${user._id} (${user.email}) marked as online`);

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
    const { userId, authMethod, forceOffline, sessionId, source } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // If the request doesn't have a user object, use the userId from the body
    const userIdToUpdate = req.user?._id || userId;

    // Check if this is a Google user and log the source
    const isGoogleUser = authMethod === 'google';
    const sourceInfo = source ? ` (Source: ${source})` : '';
    
    console.log(`Setting offline status for ${isGoogleUser ? 'Google' : 'regular'} user ${userIdToUpdate}${forceOffline ? ' (FORCE OFFLINE)' : ''}${sourceInfo}`);

    // Get the current user to verify sessionId if provided
    let currentUser;
    try {
      currentUser = await User.findById(userIdToUpdate);
    } catch (findError) {
      console.error(`Error finding user ${userIdToUpdate}:`, findError);
    }

    // Only proceed if:
    // 1. This is a forced offline request (logout, browser close, etc.), OR
    // 2. No sessionId provided (backward compatibility), OR
    // 3. The provided sessionId matches the current one in the database
    const shouldProceed = forceOffline === true || 
                          !sessionId || 
                          !currentUser?.uniqueSessionId || 
                          sessionId === currentUser?.uniqueSessionId;

    if (!shouldProceed) {
      console.log(`Ignoring offline request for user ${userIdToUpdate} - session ${sessionId} does not match current session ${currentUser?.uniqueSessionId}`);
      return res.status(200).json({ message: 'Session ID mismatch, no action taken' });
    }

    // Critical update - always use direct DB access for all users for reliability
    try {
      const result = await mongoose.connection.db.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(userIdToUpdate) },
        { 
          $set: { 
            isOnline: false, 
            lastActive: new Date() 
          } 
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`User ${userIdToUpdate} marked offline successfully via direct DB access${sourceInfo}`);

        // Get the io instance from the app
        const io = req.app.get('io');
        if (io) {
          // Broadcast to all clients that user is offline
          io.emit('user_status_changed', {
            userId: userIdToUpdate,
            isOnline: false
          });
          console.log(`Broadcast offline status for user ${userIdToUpdate}`);
        }
      } else {
        console.log(`User ${userIdToUpdate} not found or already offline (direct DB access)`);
        
        // If user wasn't updated, try one more time after a small delay to handle race conditions
        setTimeout(async () => {
          try {
            const retryResult = await mongoose.connection.db.collection('users').updateOne(
              { _id: new mongoose.Types.ObjectId(userIdToUpdate) },
              { 
                $set: { 
                  isOnline: false, 
                  lastActive: new Date() 
                } 
              }
            );
            
            if (retryResult.modifiedCount > 0) {
              console.log(`RETRY: User ${userIdToUpdate} marked offline successfully after delay${sourceInfo}`);

              // Get the io instance from the app
              const io = req.app.get('io');
              if (io) {
                // Broadcast to all clients that user is offline
                io.emit('user_status_changed', {
                  userId: userIdToUpdate,
                  isOnline: false
                });
              }
            }
          } catch (retryError) {
            console.error(`Error in delayed retry for user ${userIdToUpdate}:`, retryError);
          }
        }, 300);
      }
    } catch (dbError) {
      console.error(`DATABASE ERROR marking user ${userIdToUpdate} as offline:`, dbError);
      
      // Fallback to standard Mongoose method if direct DB access fails
      const updatedUser = await User.findByIdAndUpdate(userIdToUpdate, {
        isOnline: false,
        lastActive: new Date()
      }, { new: true });

      if (updatedUser) {
        console.log(`FALLBACK: User ${userIdToUpdate} (${updatedUser.email}) has been marked as offline via Mongoose${sourceInfo}`);
        
        // Get the io instance from the app
        const io = req.app.get('io');
        if (io) {
          // Broadcast to all clients that user is offline
          io.emit('user_status_changed', {
            userId: userIdToUpdate,
            isOnline: false
          });
        }
      }
    }

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

      // Check if this is a Google user for special handling
      const user = await User.findById(userId);
      const isGoogleUser = user?.lastAuthMethod === 'google';
      
      console.log(`Logout requested for ${isGoogleUser ? 'Google' : 'regular'} user ${userId} (from request body)`);
      
      // Mark user as offline with direct DB access for critical reliability
      const result = await mongoose.connection.db.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            isOnline: false,
            lastActive: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`User ${userId} has been logged out and marked as offline successfully`);
      } else {
        console.log(`User ${userId} logout called but user was not found or already offline`);
      }
    } else {
      // Check if this is a Google user for special handling
      const user = await User.findById(req.user._id);
      const isGoogleUser = user?.lastAuthMethod === 'google';
      
      console.log(`Logout requested for ${isGoogleUser ? 'Google' : 'regular'} user ${req.user._id} (from auth token)`);
      
      // Mark authenticated user as offline with direct DB access
      const result = await mongoose.connection.db.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(req.user._id) },
        {
          $set: {
            isOnline: false,
            lastActive: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`User ${req.user._id} (${req.user.email}) has been logged out and marked as offline successfully`);
      } else {
        console.log(`User ${req.user._id} logout called but user was not found or already offline`);
      }
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
    console.log('Beacon request content-type:', req.headers['content-type']);

    // For beacon requests, we need to handle different body formats
    let userId: string | undefined;
    let authMethod: string | undefined;
    let forceOffline: boolean | undefined;
    let sessionId: string | undefined;
    let source: string | undefined;

    if (Buffer.isBuffer(req.body)) {
      // Handle raw Buffer from express.raw middleware
      try {
        const rawBody = req.body.toString('utf8');
        console.log('Buffer content converted to string:', rawBody);
        const parsedBody = JSON.parse(rawBody);
        userId = parsedBody.userId;
        authMethod = parsedBody.authMethod;
        forceOffline = parsedBody.forceOffline;
        sessionId = parsedBody.sessionId;
        source = parsedBody.source;
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
        authMethod = parsedBody.authMethod;
        forceOffline = parsedBody.forceOffline;
        sessionId = parsedBody.sessionId;
        source = parsedBody.source;
        console.log('Extracted userId from string:', userId);
      } catch (parseError) {
        console.error('Error parsing string beacon body:', parseError);
      }
    } else if (req.body && typeof req.body === 'object') {
      // Handle object body (already parsed by bodyParser)
      userId = req.body.userId;
      authMethod = req.body.authMethod;
      forceOffline = req.body.forceOffline;
      sessionId = req.body.sessionId;
      source = req.body.source;
      console.log('Extracted userId from object:', userId);
    }

    if (!userId) {
      console.error('Missing userId in beacon request. Body:', req.body);
      return res.status(200).end(); // Always return 200 for beacon calls
    }

    // Check if this is a Google user
    let isGoogleUser = authMethod === 'google';
    const isPriority = forceOffline === true || isGoogleUser;
    const sourceInfo = source ? ` (Source: ${source})` : '';
    
    console.log(`BEACON: Processing request to set ${isGoogleUser ? 'Google' : 'regular'} user ${userId} as offline${isPriority ? ' (PRIORITY)' : ''}${sourceInfo}`);

    // Get the current user to verify sessionId if provided
    let currentUser: any = null;
    try {
      currentUser = await User.findById(userId);
      
      // If auth method not provided, check the database
      if (!authMethod && currentUser) {
        if (currentUser.lastAuthMethod === 'google') {
          console.log(`BEACON: User ${userId} identified from database as a Google OAuth user`);
          isGoogleUser = true;
        }
      }
    } catch (findError) {
      console.error(`Error finding user ${userId}:`, findError);
    }

    // Only proceed if:
    // 1. This is a forced offline request (browser close, etc.), OR
    // 2. No sessionId provided (backward compatibility), OR
    // 3. The provided sessionId matches the current one in the database
    const shouldProceed = forceOffline === true || 
                          !sessionId || 
                          !currentUser?.uniqueSessionId || 
                          sessionId === currentUser?.uniqueSessionId;

    if (!shouldProceed) {
      console.log(`BEACON: Ignoring offline request for user ${userId} - session ${sessionId} does not match current session ${currentUser?.uniqueSessionId}`);
      return res.status(200).end(); // Always return 200 for beacon calls
    }
      
    // CRITICAL UPDATE: Use direct database connection for maximum reliability
    try {      
      // Update user's online status to false - force using direct MongoDB driver
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
        console.log(`BEACON: User ${userId} has been marked as offline via beacon${sourceInfo}`);
        
        // Get the io instance from the req.app to broadcast the update
        const io = (req as any).app?.get('io');
        if (io) {
          // Broadcast to all clients that user is offline
          io.emit('user_status_changed', {
            userId,
            isOnline: false
          });
        }
      } else {
        console.warn(`BEACON: User ${userId} not found or already offline`);
        
        // If it's a Google user and we didn't modify anything, try once more with a delay
        if (isGoogleUser) {
          console.log(`BEACON: Will retry Google user ${userId} after 500ms delay`);
          setTimeout(async () => {
            try {
              const retryResult = await db.collection('users').updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                  $set: {
                    isOnline: false,
                    lastActive: new Date()
                  }
                }
              );
              
              if (retryResult.modifiedCount > 0) {
                console.log(`BEACON: Retry successful, marked Google user ${userId} as OFFLINE${sourceInfo}`);
                
                // Get the io instance from the req.app to broadcast the update
                const io = (req as any).app?.get('io');
                if (io) {
                  // Broadcast to all clients that user is offline
                  io.emit('user_status_changed', {
                    userId,
                    isOnline: false
                  });
                }
              } else {
                console.log(`BEACON: Retry failed, Google user ${userId} still not updated`);
              }
            } catch (retryError) {
              console.error(`Error in delayed retry for Google user ${userId}:`, retryError);
            }
          }, 500);
        }
      }
    } catch (dbError) {
      console.error(`DATABASE ERROR during beacon processing for user ${userId}:`, dbError);
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
    // For debugging
    console.log('BROWSER CLOSED: Request received with content-type:', req.headers['content-type']);
    
    // Extract user ID and auth method from request - handle multiple formats
    let userId: string | undefined;
    let authMethod: string | undefined;
    let timestamp: string | undefined;
    let forceOffline: boolean | undefined;
    let sessionId: string | undefined;
    let source: string | undefined;
    
    // First try to get it from the parsed body (JSON format)
    if (req.body && typeof req.body === 'object') {
      userId = req.body.userId;
      authMethod = req.body.authMethod;
      timestamp = req.body.timestamp;
      forceOffline = req.body.forceOffline;
      sessionId = req.body.sessionId;
      source = req.body.source;
    } 
    // Then try buffer format (for raw requests)
    else if (Buffer.isBuffer(req.body)) {
      try {
        const rawBody = req.body.toString('utf8');
        const parsedBody = JSON.parse(rawBody);
        userId = parsedBody.userId;
        authMethod = parsedBody.authMethod;
        timestamp = parsedBody.timestamp;
        forceOffline = parsedBody.forceOffline;
        sessionId = parsedBody.sessionId;
        source = parsedBody.source;
      } catch (parseError) {
        console.error('Error parsing buffer body in browser close handler:', parseError);
      }
    }
    // Then try string format
    else if (typeof req.body === 'string') {
      try {
        const parsedBody = JSON.parse(req.body);
        userId = parsedBody.userId;
        authMethod = parsedBody.authMethod;
        timestamp = parsedBody.timestamp;
        forceOffline = parsedBody.forceOffline;
        sessionId = parsedBody.sessionId;
        source = parsedBody.source;
      } catch (parseError) {
        console.error('Error parsing string body in browser close handler:', parseError);
      }
    }

    if (!userId) {
      console.error('Missing userId in browser close request. Body:', req.body);
      return res.status(200).end(); // Always return 200 for browser close events
    }

    // Special handling for Google users
    let isGoogleUser = authMethod === 'google';
    const isPriority = forceOffline === true || isGoogleUser;
    const sourceInfo = source ? ` (Source: ${source})` : '';
    
    console.log(`BROWSER CLOSED: Processing critical update for ${isGoogleUser ? 'Google' : 'regular'} user ${userId}${isPriority ? ' (FORCE OFFLINE)' : ''}${sourceInfo}`);
    if (timestamp) {
      console.log(`BROWSER CLOSED: Event timestamp: ${timestamp}`);
    }

    // Get the current user to verify sessionId if provided
    let currentUser: any = null;
    try {
      // Check if the user is a Google user from database if not provided in request
      currentUser = await User.findById(userId);
      if (!authMethod && currentUser?.lastAuthMethod === 'google') {
        console.log(`BROWSER CLOSED: User ${userId} identified from database as a Google OAuth user`);
        isGoogleUser = true;
      }
    } catch (findError) {
      console.error(`Error finding user ${userId}:`, findError);
    }

    // Only proceed if:
    // 1. This is a forced offline request (browser close, etc.), OR
    // 2. No sessionId provided (backward compatibility), OR
    // 3. The provided sessionId matches the current one in the database
    const shouldProceed = forceOffline === true || 
                          !sessionId || 
                          !currentUser?.uniqueSessionId || 
                          sessionId === currentUser?.uniqueSessionId;

    if (!shouldProceed) {
      console.log(`BROWSER CLOSED: Ignoring offline request for user ${userId} - session ${sessionId} does not match current session ${currentUser?.uniqueSessionId}`);
      return res.status(200).end(); // Always return 200 for browser close calls
    }
    
    // CRITICAL FIX: Use a more direct database approach
    try {    
      // Directly update the user's status with highest priority
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
        console.log(`BROWSER CLOSED: Successfully marked ${isGoogleUser ? 'Google' : 'regular'} user ${userId} as OFFLINE${sourceInfo}`);
        
        // Get the io instance from the req.app to broadcast the update
        const io = (req as any).app?.get('io');
        if (io) {
          // Broadcast to all clients that user is offline
          io.emit('user_status_changed', {
            userId,
            isOnline: false
          });
        }
      } else {
        console.log(`BROWSER CLOSED: User ${userId} not found or already offline`);
        
        // If it's a Google user and we didn't modify anything, try once more with a delay
        // This helps with race conditions where the user record is being updated elsewhere
        if (isGoogleUser) {
          console.log(`BROWSER CLOSED: Will retry Google user ${userId} after 500ms delay`);
          setTimeout(async () => {
            try {
              const retryResult = await db.collection('users').updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                  $set: {
                    isOnline: false,
                    lastActive: new Date()
                  }
                }
              );
              
              if (retryResult.modifiedCount > 0) {
                console.log(`BROWSER CLOSED: Retry successful, marked Google user ${userId} as OFFLINE${sourceInfo}`);
                
                // Get the io instance from the req.app to broadcast the update
                const io = (req as any).app?.get('io');
                if (io) {
                  // Broadcast to all clients that user is offline
                  io.emit('user_status_changed', {
                    userId,
                    isOnline: false
                  });
                }
              } else {
                console.log(`BROWSER CLOSED: Retry failed, Google user ${userId} still not updated`);
              }
            } catch (retryError) {
              console.error(`Error in delayed retry for Google user ${userId}:`, retryError);
            }
          }, 500);
        }
      }
    } catch (dbError) {
      console.error(`CRITICAL DATABASE ERROR during browser close for user ${userId}:`, dbError);
    }

    // Always return 200 for browser close calls
    res.status(200).end();
  } catch (error) {
    console.error('Error handling browser close:', error);
    // Always return 200 for browser close calls even on error
    res.status(200).end();
  }
}; 
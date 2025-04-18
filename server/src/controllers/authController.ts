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
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import * as emailUtils from '../utils/emailUtils';

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

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
    const { email, password, firstName, lastName, phone, address, verificationType = 'link' } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Validate email format
    if (!emailUtils.isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    // Require Gmail addresses only
    if (!emailUtils.isGmailAddress(email)) {
      return res.status(400).json({ 
        message: 'Only Gmail addresses are accepted for registration. Please use a Gmail address or sign in with Google.'
      });
    }

    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists but isn't verified, we can allow them to request a new verification
      if (existingUser.isEmailVerified === false) {
        return res.status(400).json({ 
          message: 'An account with this email already exists but has not been verified',
          requiresVerification: true,
          email: email
        });
      }
      
      // If user has a Google account, suggest using Google sign-in
      if (existingUser.googleId) {
        return res.status(400).json({ 
          message: 'An account with this email already exists. Please sign in with Google instead.',
          useGoogle: true
        });
      }
      
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    let verificationSent = false;
    
    // Generate a unique session ID for this registration
    const sessionId = generateSessionId();
    
    // Create new user with appropriate verification method and online status tracking
    const newUser = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
      address,
      isEmailVerified: false,
      isOnline: false, // Start as offline until email is verified
      lastActive: new Date(),
      lastAuthMethod: 'password',
      uniqueSessionId: sessionId,
      status: 'active'
    });

    if (verificationType === 'link') {
      // Generate verification token and link
      const { token, expires } = emailUtils.generateVerificationToken();
      newUser.emailVerificationToken = token;
      newUser.emailVerificationExpires = expires;
      
      // Send verification email with link
      verificationSent = await emailUtils.sendVerificationEmail(email, token);
    } else {
      // Generate verification code
      const code = emailUtils.generateVerificationCode();
      const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      newUser.verificationCode = code;
      newUser.verificationCodeExpires = codeExpires;
      
      // Send verification email with code
      verificationSent = await emailUtils.sendVerificationCode(email, code);
    }
    
    if (!verificationSent) {
      return res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
    }

    await newUser.save();

    res.status(201).json({ 
      message: `Registration successful. Please check your email to verify your account.${verificationType === 'code' ? ' We have sent a 6-digit verification code.' : ''}`,
      verificationType,
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

/**
 * Verify email with token
 * @route GET /api/auth/verify-email/:token
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token: verificationToken } = req.params;

    // Check if user exists with this token
    const user = await User.findOne({
      emailVerificationToken: verificationToken,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    // Check if another user with the same email is already online
    // If so, mark them as offline to prevent duplicate online status
    await User.updateMany(
      { email: user.email, isOnline: true },
      { 
        $set: { 
          isOnline: false,
          lastActive: new Date()
        } 
      }
    );

    // Generate a unique session ID for this verification
    const sessionId = generateSessionId();

    // Update user status
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.isOnline = true;
    user.lastActive = new Date();
    user.uniqueSessionId = sessionId;
    await user.save();

    // Generate JWT token for automatic login after verification
    const jwtToken = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.role,
        authMethod: 'password',
        sessionId: sessionId
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '7d' }
    );

    res.status(200).json({ 
      message: 'Email verified successfully',
      success: true,
      token: jwtToken,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isOnline: user.isOnline,
        lastActive: user.lastActive
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Email verification failed' });
  }
};

/**
 * Verify email with code
 * @route POST /api/auth/verify-email-code
 */
export const verifyEmailWithCode = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

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

    const user = await User.findOne({
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Generate a unique session ID for this verification
    const sessionId = generateSessionId();

    // Update user status
    user.isEmailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.isOnline = true;
    user.lastActive = new Date();
    user.uniqueSessionId = sessionId;
    await user.save();

    // Generate JWT token for automatic login after verification
    const token = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        role: user.role,
        authMethod: 'password',
        sessionId: sessionId
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '7d' }
    );

    res.status(200).json({ 
      message: 'Email verified successfully',
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isOnline: user.isOnline,
        lastActive: user.lastActive
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: 'Email verification failed' });
  }
};

/**
 * Resend verification email
 * @route POST /api/auth/resend-verification
 */
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email, verificationType = 'link' } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    let verificationSent = false;

    if (verificationType === 'link') {
      // Generate new verification token
      const { token, expires } = emailUtils.generateVerificationToken();
      
      user.emailVerificationToken = token;
      user.emailVerificationExpires = expires;
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      
      // Send verification email with link
      verificationSent = await emailUtils.sendVerificationEmail(email, token);
    } else {
      // Generate verification code
      const code = emailUtils.generateVerificationCode();
      const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      user.verificationCode = code;
      user.verificationCodeExpires = codeExpires;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      
      // Send verification email with code
      verificationSent = await emailUtils.sendVerificationCode(email, code);
    }

    if (!verificationSent) {
      return res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
    }

    await user.save();

    res.status(200).json({ 
      message: `Verification email sent successfully${verificationType === 'code' ? '. Check your email for a 6-digit verification code.' : '.'}`,
      verificationType
    });
  } catch (error) {
    console.error('Resend verification email error:', error);
    res.status(500).json({ message: 'Failed to resend verification email' });
  }
};

/**
 * Login a user
 * @route POST /api/auth/login
 */
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user has a Google account and suggest Google sign-in
    if (user.googleId && !user.password) {
      return res.status(403).json({ 
        message: 'This account uses Google Sign-In. Please sign in with Google instead.',
        useGoogle: true,
        email: user.email
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email address before logging in',
        requiresVerification: true,
        email: user.email
      });
    }

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

    // Update online status and session ID using direct database access for reliability
    const result = await mongoose.connection.db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          isOnline: true,
          lastActive: new Date(),
          lastAuthMethod: 'password',
          uniqueSessionId: sessionId
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`User ${user._id} (${user.email}) marked as online successfully`);
      
      // Get the io instance from the req.app to broadcast the update
      const io = (req as any).app?.get('io');
      if (io) {
        // Broadcast to all clients that user is online
        io.emit('user_status_changed', {
          userId: user._id,
          isOnline: true
        });
      }
    }

    // Create JWT token
    const token = jwt.sign(
      {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        authMethod: 'password',
        sessionId: sessionId
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: rememberMe ? '30d' : '1d' }
    );

    // Return token and user info (excluding password)
    const userResponse = user.toObject();
    const userWithoutPassword = { ...userResponse, password: undefined };

    res.status(200).json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error instanceof Error ? error.message : 'Unknown error' });
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
    
    console.log(`Setting offline status for user ${userIdToUpdate}${forceOffline ? ' (FORCE OFFLINE)' : ''}${source ? ` (Source: ${source})` : ''}`);

    // Critical update - use direct database access for reliability
    try {
      const result = await mongoose.connection.db.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(userIdToUpdate) },
        { 
          $set: { 
            isOnline: false,
            lastActive: new Date(),
            lastStatusUpdate: Date.now() // Add timestamp for versioning
          } 
        }
      );

      if (result.modifiedCount > 0) {
        // Get the io instance from the app
        const io = req.app.get('io');
        if (io) {
          // Broadcast with version number
          io.emit('user_status_changed', {
            userId: userIdToUpdate,
            isOnline: false,
            lastActive: new Date(),
            version: Date.now()
          });
        }

        // Force a small delay before responding to ensure the offline status is processed
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (dbError) {
      console.error(`DATABASE ERROR marking user ${userIdToUpdate} as offline:`, dbError);
    }

    res.status(200).json({ message: 'User set as offline successfully' });
  } catch (error) {
    console.error('Error setting user offline:', error);
    res.status(500).json({ message: 'Failed to set user as offline' });
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

    const now = new Date();
    const currentVersion = Date.now();

    console.log(`Received ping for user ${userId}`);
    
    // Use direct database access for maximum performance and reliability
    const result = await mongoose.connection.db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { 
        $set: { 
          isOnline: true,
          lastActive: now,
          lastStatusUpdate: currentVersion
        } 
      }
    );

    // If user was updated successfully
    if (result.modifiedCount > 0) {
      console.log(`User ${userId} marked as ONLINE via ping`);
      
      // Get socket.io instance to broadcast the status change
      const io = (req as any).app?.get('io');
      if (io) {
        // Broadcast to all clients that this user is online
        io.emit('user_status_changed', {
          userId,
          isOnline: true,
          lastActive: now,
          version: currentVersion
        });
        
        // Also broadcast with simpler format for compatibility
        io.emit('user_connected', {
          userId
        });
        
        console.log(`Broadcast online status for user ${userId} to all clients`);
      } else {
        console.warn('Socket.io instance not available for broadcasting');
      }
    }

    res.status(200).json({ 
      success: true,
      isOnline: true,
      lastActive: now
    });
  } catch (error) {
    console.error('Error updating ping status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update the checkInactiveUsers function to include versioning
export const checkInactiveUsers = async () => {
  try {
    const inactiveThreshold = new Date(Date.now() - 15000);
    const currentVersion = Date.now();
    
    const result = await mongoose.connection.db.collection('users').updateMany(
      { 
        isOnline: true,
        lastActive: { $lt: inactiveThreshold }
      },
      {
        $set: { 
          isOnline: false,
          lastActive: new Date(),
          lastStatusUpdate: currentVersion
        }
      }
    );

    if (result.modifiedCount > 0) {
      // Get the io instance (you'll need to make this available)
      const io = global.io;
      if (io) {
        // Broadcast all status changes
        const users = await mongoose.connection.db.collection('users')
          .find({ lastStatusUpdate: currentVersion })
          .toArray();
        
        users.forEach(user => {
          io.emit('user_status_changed', {
            userId: user._id,
            isOnline: false,
            lastActive: user.lastActive,
            version: currentVersion
          });
        });
      }
    }
  } catch (error) {
    console.error('Error checking inactive users:', error);
  }
};

// Set up interval to check for inactive users
setInterval(checkInactiveUsers, 5000); // Check every 5 seconds

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

/**
 * Request a password reset by sending an email with a reset token
 * @route POST /api/auth/reset-password-request
 */
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // For security reasons, don't reveal if email exists or not
      return res.status(200).json({ 
        message: 'If your email is registered with us, you will receive password reset instructions.' 
      });
    }
    
    // Generate a reset token and expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Save token and expiry to user
    user.resetToken = token;
    user.resetTokenExpiry = expires;
    await user.save();
    
    // Send reset email
    const emailSent = await emailUtils.sendPasswordResetEmail(email, token);
    
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
    }
    
    res.status(200).json({ 
      message: 'Password reset instructions have been sent to your email.' 
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ 
      message: 'Server error processing password reset',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Reset password using token
 * @route POST /api/auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    
    // Check if password meets minimum requirements
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    // Find user with this token
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    
    // Update password and clear reset token fields
    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    
    res.status(200).json({ message: 'Password has been reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      message: 'Server error processing password reset',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 
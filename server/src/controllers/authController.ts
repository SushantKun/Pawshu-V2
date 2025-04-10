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
    const { email, password } = req.body;

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

    // Create token
    const token = jwt.sign(
      { 
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: 'user'
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
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
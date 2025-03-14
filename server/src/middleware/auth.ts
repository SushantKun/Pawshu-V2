import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Extend the Request type to include user information
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role?: string;
  };
}

// Middleware to verify JWT token
export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('Auth middleware - Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('Auth middleware - No token provided');
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as { id: string, role?: string };
      console.log('Auth middleware - Token verified successfully for user:', decoded.id);
      
      // Add user from payload to request object
      req.user = {
        id: decoded.id,
        role: decoded.role
      };
      
      next();
    } catch (error) {
      console.error('Auth middleware - Token verification failed:', error);
      return res.status(401).json({ message: 'Token verification failed, authorization denied' });
    }
  } catch (error) {
    console.error('Auth middleware - Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Middleware to verify admin role
export const adminAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // First verify the token
    await auth(req, res, (err?: any) => {
      if (err) {
        return next(err);
      }
      
      // Check if user exists and has admin role
      if (!req.user) {
        console.log('AdminAuth middleware - No user found after token verification');
        return res.status(401).json({ message: 'Authorization denied' });
      }
      
      console.log('AdminAuth middleware - User role:', req.user.role);
      
      if (req.user.role !== 'admin') {
        console.log('AdminAuth middleware - User is not an admin');
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }
      
      console.log('AdminAuth middleware - Admin access granted');
      next();
    });
  } catch (error) {
    console.error('AdminAuth middleware - Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Middleware to verify doctor role
export const doctorAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // First verify the token
    await auth(req, res, (err?: any) => {
      if (err) {
        return next(err);
      }
      
      // Check if user exists and has doctor role
      if (!req.user) {
        console.log('DoctorAuth middleware - No user found after token verification');
        return res.status(401).json({ message: 'Authorization denied' });
      }
      
      console.log('DoctorAuth middleware - User role:', req.user.role);
      
      if (req.user.role !== 'doctor') {
        console.log('DoctorAuth middleware - User is not a doctor');
        return res.status(403).json({ message: 'Access denied. Doctor privileges required.' });
      }
      
      console.log('DoctorAuth middleware - Doctor access granted');
      next();
    });
  } catch (error) {
    console.error('DoctorAuth middleware - Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
}; 
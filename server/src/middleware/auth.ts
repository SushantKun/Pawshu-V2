import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

interface UserPayload {
  _id: Types.ObjectId;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

// Middleware to verify admin role
export const adminAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // First verify the token
    await verifyToken(req, res, (err?: any) => {
      if (err) {
        return next(err);
      }
      
      // Check if user exists and has admin role
      if (!req.user) {
        console.log('AdminAuth middleware - No user found after token verification');
        return res.status(401).json({ message: 'Authorization denied' });
      }
      
      console.log('AdminAuth middleware - User role:', req.user.isAdmin);
      
      if (!req.user.isAdmin) {
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
    await verifyToken(req, res, (err?: any) => {
      if (err) {
        return next(err);
      }
      
      // Check if user exists and has doctor role
      if (!req.user) {
        console.log('DoctorAuth middleware - No user found after token verification');
        return res.status(401).json({ message: 'Authorization denied' });
      }
      
      console.log('DoctorAuth middleware - User role:', req.user.isAdmin);
      
      if (req.user.isAdmin) {
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
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { FileArray, UploadedFile } from 'express-fileupload';

export interface UserPayload {
  _id: Types.ObjectId;
  email: string;
  role: string;
  name: string;
  isAdmin: boolean;
}

// Extend the Express Request type
export interface AuthRequest extends Request {
  user?: UserPayload;
  // files is already declared in express-fileupload.d.ts
}

// Type guard for file upload
export function hasFiles(req: Request): req is Request & { files: FileArray } {
  return req.files !== undefined && req.files !== null;
}

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin auth middleware
export const adminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    (req as AuthRequest).user = decoded;
    
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ message: 'Authorization denied' });
    }
    
    if (!authReq.user.isAdmin && authReq.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// Doctor auth middleware
export const doctorAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    (req as AuthRequest).user = decoded;
    
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ message: 'Authorization denied' });
    }
    
    if (authReq.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied. Doctor privileges required.' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user?.isAdmin && authReq.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error checking admin role' });
  }
};

export const isDoctor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthRequest;
    if (authReq.user?.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied. Doctor role required.' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error checking doctor role' });
  }
}; 
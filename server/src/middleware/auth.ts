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
    console.log('Checking admin authorization...');
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.log('Admin auth failed: No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as UserPayload;
      console.log('Token decoded:', { 
        userId: decoded._id, 
        email: decoded.email, 
        role: decoded.role,
        isAdmin: decoded.isAdmin 
      });
      (req as AuthRequest).user = decoded;
      
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        console.log('Admin auth failed: No user in request after token verification');
        return res.status(401).json({ message: 'Authorization denied' });
      }
      
      // Allow access if either isAdmin flag is true or role is explicitly 'admin'
      if (!authReq.user.isAdmin && authReq.user.role !== 'admin') {
        console.log('Admin auth failed: User is not admin', { 
          isAdmin: authReq.user.isAdmin, 
          role: authReq.user.role 
        });
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }
      
      console.log('Admin authorization successful');
      next();
    } catch (tokenError) {
      console.error('Admin auth token verification failed:', tokenError);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Admin auth unexpected error:', error);
    res.status(500).json({ 
      message: 'Server Error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Doctor auth middleware
export const doctorAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('Checking doctor authorization...');
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.log('Doctor auth failed: No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as UserPayload;
      console.log('Token decoded:', { 
        userId: decoded._id, 
        email: decoded.email, 
        role: decoded.role
      });
      (req as AuthRequest).user = decoded;
      
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        console.log('Doctor auth failed: No user in request after token verification');
        return res.status(401).json({ message: 'Authorization denied' });
      }
      
      if (authReq.user.role !== 'doctor') {
        console.log('Doctor auth failed: User is not a doctor', { role: authReq.user.role });
        return res.status(403).json({ message: 'Access denied. Doctor privileges required.' });
      }
      
      console.log('Doctor authorization successful');
      next();
    } catch (tokenError) {
      console.error('Doctor auth token verification failed:', tokenError);
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Doctor auth unexpected error:', error);
    res.status(500).json({ 
      message: 'Server Error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
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
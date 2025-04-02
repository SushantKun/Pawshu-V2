import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { FileArray, UploadedFile } from 'express-fileupload';
import User from '../models/User';
import { AuthUser, AuthRequest } from '../types/auth';

// Type guard for file upload
export function hasFiles(req: Request): req is Request & { files: FileArray } {
  return req.files !== undefined && req.files !== null;
}

export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log(`[Auth Debug] Verifying token for path: ${req.path}`);
    console.log(`[Auth Debug] Authorization header present: ${!!req.header('Authorization')}`);
    
    // Log full Authorization header for debugging
    console.log(`[Auth Debug] Auth header value: ${req.header('Authorization')?.substring(0, 20)}...`);
    
    // For payment endpoints, log additional details
    if (req.path.includes('payment')) {
      console.log('[Auth Debug] Payment endpoint detected');
      console.log('[Auth Debug] Request body:', JSON.stringify(req.body));
      console.log('[Auth Debug] Request method:', req.method);
      console.log('[Auth Debug] Request query params:', JSON.stringify(req.query));
    }

    if (!token) {
      console.log('[Auth Debug] No token provided in Authorization header');
      res.status(401).json({ message: 'No token, authorization denied' });
      return;
    }

    // Log token length for verification
    console.log(`[Auth Debug] Token length: ${token.length}`);
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Auth Debug] JWT_SECRET is not defined in environment variables');
      res.status(500).json({ message: 'Server error' });
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as AuthUser;
      console.log(`[Auth Debug] Token verified successfully for user: ${decoded._id}`);
      
      req.user = {
        ...decoded,
        _id: new Types.ObjectId(decoded._id.toString()) // Convert string _id to ObjectId if needed
      };
      
      if (req.user) {
        console.log(`[Auth Debug] User object set on request: ${JSON.stringify({
          _id: req.user._id.toString(),
          email: req.user.email,
          role: req.user.role,
          isAdmin: req.user.isAdmin, 
          isDoctor: req.user.isDoctor
        })}`);
      }

      next();
    } catch (jwtError) {
      console.error('[Auth Debug] JWT verification failed:', jwtError);
      
      // Try to decode the token for debugging, even if it's not valid
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log('[Auth Debug] Token payload:', payload);
          console.log('[Auth Debug] Token expiration:', new Date(payload.exp * 1000));
          console.log('[Auth Debug] Current time:', new Date());
        }
      } catch (e) {
        console.error('[Auth Debug] Could not decode token for debugging:', e);
      }
      
      res.status(401).json({ message: 'Token is not valid' });
    }
  } catch (error) {
    console.error('[Auth Debug] Token processing error:', error);
    res.status(401).json({ message: 'Token is not valid' });
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as AuthUser;
      console.log('Token decoded:', { 
        userId: decoded._id, 
        email: decoded.email,
        role: decoded.role,
        isAdmin: decoded.isAdmin || decoded.avatar?.isAdmin 
      });
      (req as AuthRequest).user = decoded;
      
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        console.log('Admin auth failed: No user in request after token verification');
        return res.status(401).json({ message: 'Authorization denied' });
      }
      
      // Allow access if isAdmin flag is true or role is 'admin'
      const isUserAdmin = authReq.user.isAdmin || authReq.user.avatar?.isAdmin || false;
      if (!isUserAdmin && authReq.user.role !== 'admin') {
        console.log('Admin auth failed: User is not admin', { 
          isAdmin: isUserAdmin,
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
    console.log(`Doctor auth request path: ${req.path}`);
    
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.log('Doctor auth failed: No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as AuthUser;
      console.log('Token decoded for doctor auth:', { 
        userId: decoded._id, 
        email: decoded.email,
        role: decoded.role,
        isDoctor: decoded.isDoctor || decoded.avatar?.isDoctor
      });
      
      // Add the decoded user to the request
      (req as AuthRequest).user = decoded;
      
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        console.log('Doctor auth failed: No user in request after token verification');
        return res.status(401).json({ message: 'Authorization denied' });
      }
      
      // Check for doctor privileges - either isDoctor flag or role field
      const isUserDoctor = authReq.user.isDoctor || authReq.user.avatar?.isDoctor || false;
      if (!isUserDoctor && authReq.user.role !== 'doctor') {
        console.log('Doctor auth failed: User is not a doctor', { 
          isDoctor: isUserDoctor,
          role: authReq.user.role
        });
        return res.status(403).json({ message: 'Access denied. Doctor privileges required.' });
      }
      
      console.log('Doctor authorization successful for path:', req.path);
      next();
    } catch (tokenError) {
      console.error('Doctor auth token verification failed:', tokenError);
      
      // Try to decode the token for debugging, even if it's not valid
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log('Doctor auth - Token payload:', payload);
          console.log('Doctor auth - Token expiration:', new Date((payload.exp || 0) * 1000));
          console.log('Doctor auth - Current time:', new Date());
        }
      } catch (e) {
        console.error('Could not decode token for debugging:', e);
      }
      
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

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  
  const isUserAdmin = req.user.isAdmin || req.user.avatar?.isAdmin || false;
  if (!isUserAdmin && req.user.role !== 'admin') {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  next();
};

export const isDoctor = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  
  const isUserDoctor = req.user.isDoctor || req.user.avatar?.isDoctor || false;
  if (!isUserDoctor && req.user.role !== 'doctor') {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  next();
}; 
import { Request } from 'express';
import { Types } from 'mongoose';

export interface AuthUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
} 
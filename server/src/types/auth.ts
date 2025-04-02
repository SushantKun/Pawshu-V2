import { Request } from 'express';
import { Types } from 'mongoose';
import { MulterFile } from './multer';

export interface AuthUser {
  _id: Types.ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: string;
  isAdmin?: boolean;
  isDoctor?: boolean;
  avatar?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    isAdmin?: boolean;
    isDoctor?: boolean;
    verified?: boolean;
    status?: string;
  };
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  file?: MulterFile;
  files?: MulterFile[] | null;
} 
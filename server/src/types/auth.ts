import { Request } from 'express';
import { Types } from 'mongoose';
import { MulterFile } from './multer';

export interface AuthUser {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isAdmin: boolean;
  isDoctor: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  file?: MulterFile;
  files?: MulterFile[] | null;
} 
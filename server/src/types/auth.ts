import { Request } from 'express';
import { Types } from 'mongoose';
import { MulterFile } from './multer';

export interface AuthUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  file?: MulterFile;
  files?: MulterFile[] | null;
} 
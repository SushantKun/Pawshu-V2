// Type definitions for express-fileupload
// This fixes the conflict between express-fileupload and @types/express
import { FileArray, UploadedFile } from 'express-fileupload';

// Direct extension of the Express namespace
declare global {
  namespace Express {
    interface Request {
      files?: {
        [fieldname: string]: UploadedFile | UploadedFile[];
      } | null;
    }
  }
}

// Augment express module
declare module 'express' {
  interface Request {
    files?: {
      [fieldname: string]: UploadedFile | UploadedFile[];
    } | null;
  }
} 
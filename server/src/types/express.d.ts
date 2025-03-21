import { FileArray } from 'express-fileupload';
import { UserPayload } from '../middleware/auth';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      user?: UserPayload;
      files?: any; // Using any to avoid type conflicts
    }
  }
}

export {}; 
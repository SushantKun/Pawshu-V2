import { Request, Response, NextFunction } from 'express';

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

declare global {
  namespace Express {
    interface Multer {
      File: MulterFile;
    }
  }
}

declare module 'multer' {
  interface FileFilterCallback {
    (error: Error | null, acceptFile: boolean): void;
  }

  interface Multer {
    single(fieldName: string): (req: any, res: Response, next: NextFunction) => void;
    array(fieldName: string, maxCount?: number): (req: any, res: Response, next: NextFunction) => void;
    fields(fields: Array<{ name: string; maxCount?: number }>): (req: any, res: Response, next: NextFunction) => void;
    none(): (req: any, res: Response, next: NextFunction) => void;
    any(): (req: any, res: Response, next: NextFunction) => void;
  }

  interface Options {
    dest?: string;
    storage?: any;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    preservePath?: boolean;
    fileFilter?(req: Request, file: MulterFile, callback: FileFilterCallback): void;
  }

  function multer(options?: Options): Multer;
  export = multer;
}

declare module 'express' {
  interface Request {
    file?: MulterFile;
    files?: MulterFile[] | null;
  }

  interface RequestHandler<P = any, ResBody = any, ReqBody = any, ReqQuery = any> {
    (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction): any;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    file?: MulterFile;
    files?: MulterFile[] | null;
  }
} 
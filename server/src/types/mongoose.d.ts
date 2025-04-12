import { Document } from 'mongoose';

// Extend the Mongoose Document interface to include the custom methods
declare module 'mongoose' {
  interface Document {
    refreshRaisedAmount?: () => Promise<number>;
    updateRaisedAmount?: () => Promise<number>;
  }
} 
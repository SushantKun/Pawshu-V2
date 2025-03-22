import mongoose, { Schema, Document } from 'mongoose';

interface KhaltiReference {
  pidx?: string;
  initiated?: boolean;
  verified?: boolean;
  transactionId?: string;
}

export interface IDonation extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  charityId: mongoose.Types.ObjectId;
  charityName: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  paymentMethod?: 'card' | 'esewa' | 'khalti';
  createdAt: Date;
  updatedAt: Date;
  esewaRefId?: string;
  khaltiReference?: KhaltiReference;
}

const DonationSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    charityId: {
      type: Schema.Types.ObjectId,
      ref: 'Charity',
      required: true
    },
    charityName: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'esewa', 'khalti'],
      default: 'card'
    },
    esewaRefId: {
      type: String
    },
    khaltiReference: {
      pidx: String,
      initiated: Boolean,
      verified: Boolean,
      transactionId: String
    }
  },
  { timestamps: true }
);

export default mongoose.model<IDonation>('Donation', DonationSchema); 
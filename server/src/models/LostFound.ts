import mongoose, { Schema, Document } from 'mongoose';

interface ILostFound extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'lost' | 'found';
  petType: string;
  breed?: string;
  location: string;
  date: string;
  description: string;
  images: Array<{
    url: string;
    public_id?: string;
  }>;
  status: 'open' | 'resolved' | 'closed';
  contact: {
    name: string;
    email: string;
    phone?: string;
  };
  additionalDetails?: {
    color?: string;
    size?: string;
    age?: string;
    gender?: string;
    microchipped?: boolean;
    collar?: boolean;
    distinctiveFeatures?: string;
  };
  matches: Array<{
    reportId: mongoose.Types.ObjectId;
    status: 'pending' | 'confirmed' | 'rejected';
    createdAt: Date;
  }>;
  lastLocation?: {
    type: string;
    coordinates: [number, number];
  };
}

const lostFoundSchema = new Schema<ILostFound>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['lost', 'found'],
    required: true
  },
  petType: {
    type: String,
    required: true
  },
  breed: String,
  location: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  images: [{
    url: String,
    public_id: String
  }],
  status: {
    type: String,
    enum: ['open', 'resolved', 'closed'],
    default: 'open'
  },
  contact: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: String
  },
  additionalDetails: {
    color: String,
    size: String,
    age: String,
    gender: String,
    microchipped: Boolean,
    collar: Boolean,
    distinctiveFeatures: String
  },
  matches: [{
    reportId: {
      type: Schema.Types.ObjectId,
      ref: 'LostFound'
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      default: [0, 0]
    }
  }
}, {
  timestamps: true
});

// Create text index for search
lostFoundSchema.index({ description: 'text', 'contact.name': 'text', location: 'text' });

// Create geospatial index for location-based queries
lostFoundSchema.index({ lastLocation: '2dsphere' });

const LostFound = mongoose.model<ILostFound>('LostFound', lostFoundSchema);

export default LostFound; 
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  role: string;
  createdAt: Date;
  __v: number;
  avatar?: {
    public_id?: string;
    url?: string;
    status?: string;
    address?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    isAdmin?: boolean;
    isDoctor?: boolean;
    verified?: boolean;
  };
  // Top-level properties (same as in avatar)
  status?: string;
  address?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  isDoctor?: boolean;
  verified?: boolean;
  googleId?: string; // Google ID for SSO
  isEmailVerified?: boolean; // Flag to indicate if email is verified
  comparePassword(candidatePassword: string): Promise<boolean>;
  name: string; // Virtual property
  lastActive: Date;
  isOnline: boolean;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: function(this: any) {
        // Password is required only if googleId is not present
        return !this.googleId;
      }
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'doctor'],
      default: 'user'
    },
    __v: {
      type: Number,
      default: 0
    },
    // Nested avatar object
    avatar: {
      public_id: String,
      url: String,
      status: {
        type: String,
        default: 'active'
      },
      address: {
        type: String,
        default: ''
      },
      phone: {
        type: String,
        default: ''
      },
      firstName: String,
      lastName: String,
      isAdmin: {
        type: Boolean,
        default: false
      },
      isDoctor: {
        type: Boolean,
        default: false
      },
      verified: {
        type: Boolean,
        default: false
      }
    },
    // Top-level properties (same as in avatar)
    status: {
      type: String,
      default: 'active'
    },
    address: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    firstName: String,
    lastName: String,
    isAdmin: {
      type: Boolean,
      default: false
    },
    isDoctor: {
      type: Boolean,
      default: false
    },
    verified: {
      type: Boolean,
      default: false
    },
    googleId: {
      type: String,
      sparse: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    lastActive: {
      type: Date,
      default: null
    },
    isOnline: {
      type: Boolean,
      default: false
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    // Skip validation to allow for flexibility
    strict: false
  }
);

// Virtual for full name - use top-level fields if available, fallback to avatar fields
UserSchema.virtual('name').get(function(this: IUser) {
  const firstName = this.firstName || this.avatar?.firstName || '';
  const lastName = this.lastName || this.avatar?.lastName || '';
  return `${firstName} ${lastName}`.trim();
});

// Pre-save middleware to hash password
UserSchema.pre<IUser>('save', async function(next) {
  // Skip password hashing if the user has a googleId and no password
  if (this.googleId && !this.password) {
    return next();
  }
  
  // Skip password hashing if password hasn't changed
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema); 
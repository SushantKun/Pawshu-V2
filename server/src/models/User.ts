import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  avatar?: {
    public_id?: string;
    url?: string;
  };
  role: string;
  isAdmin: boolean;
  isDoctor: boolean;
  verified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  name: string; // Virtual property
}

const UserSchema: Schema = new Schema(
  {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    phone: {
      type: String
    },
    address: {
      type: String
    },
    avatar: {
      public_id: String,
      url: String
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'doctor'],
      default: 'user'
    },
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
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for full name
UserSchema.virtual('name').get(function(this: IUser) {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Pre-save middleware to hash password
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Pre-save middleware to synchronize role with isAdmin and isDoctor
UserSchema.pre<IUser>('save', function(next) {
  if (this.isModified('role')) {
    if (this.role === 'admin') {
      this.isAdmin = true;
      this.isDoctor = false;
    } else if (this.role === 'doctor') {
      this.isAdmin = false;
      this.isDoctor = true;
    } else {
      this.isAdmin = false;
      this.isDoctor = false;
    }
  } else if (this.isModified('isAdmin') || this.isModified('isDoctor')) {
    if (this.isAdmin) {
      this.role = 'admin';
    } else if (this.isDoctor) {
      this.role = 'doctor';
    } else {
      this.role = 'user';
    }
  }
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema); 
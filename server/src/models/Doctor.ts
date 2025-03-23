import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IDoctor extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  specialization: string;
  experience: number;
  bio: string;
  availability: string[]; // Format: "Day startHour-endHour", e.g., "Monday 9-12"
  isActive: boolean;
  locationPreference: 'clinic' | 'home_visit' | 'both';
  clinicAddress?: string;
  appointmentDuration: number; // in minutes
  profileImage?: {
    public_id: string;
    url: string;
  };
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const doctorSchema = new Schema<IDoctor>({
  firstName: {
    type: String,
    required: [true, 'Please provide first name'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Please provide last name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please provide password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  specialization: {
    type: String,
    required: [true, 'Please provide specialization'],
    trim: true
  },
  experience: {
    type: Number,
    required: [true, 'Please provide years of experience'],
    min: [0, 'Experience cannot be negative']
  },
  bio: {
    type: String,
    required: [true, 'Please provide a short bio'],
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  availability: [{
    type: String,
    required: [true, 'Please provide availability']
    // Format: "Day startHour-endHour", e.g., "Monday 9-12"
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  locationPreference: {
    type: String,
    enum: ['clinic', 'home_visit', 'both'],
    default: 'clinic'
  },
  clinicAddress: {
    type: String
  },
  appointmentDuration: {
    type: Number,
    default: 30, // Default to 30 minutes
    min: [15, 'Appointment duration must be at least 15 minutes']
  },
  profileImage: {
    public_id: String,
    url: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
doctorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
doctorSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    console.log('Comparing password for doctor:', this.email);
    if (!candidatePassword) {
      console.error('Empty candidate password provided');
      return false;
    }
    
    if (!this.password) {
      console.error('Doctor has no stored password');
      return false;
    }
    
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    console.log('Password comparison result:', isMatch);
    return isMatch;
  } catch (error) {
    console.error('Password comparison error:', error);
    throw new Error('Password comparison failed');
  }
};

export default mongoose.model<IDoctor>('Doctor', doctorSchema); 
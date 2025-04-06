import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IDoctor extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  specialization: string;
  experience: number;
  bio: string;
  availability: string[];
  isActive: boolean;
  locationPreference: 'clinic' | 'home_visit' | 'both';
  clinicAddress?: string;
  appointmentDuration: number;
  bookingFee: number;
  profileImage?: {
    public_id?: string;
    url?: string;
  };
  comparePassword(password: string): Promise<boolean>;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
    },
    experience: {
      type: Number,
      default: 0,
    },
    bio: {
      type: String,
      default: '',
    },
    availability: {
      type: [String],
      default: [],
      // Each availability entry should be in the format: "Day StartHour-EndHour"
      // e.g., "Monday 9-17"
      validate: {
        validator: function(v: string[]) {
          // Each entry should match this format: "Day StartHour-EndHour"
          return v.every((entry: string) => {
            return /^[A-Z][a-z]+ \d+-\d+$/.test(entry);
          });
        },
        message: props => `${props.value} is not a valid availability format! Expected format: "Day StartHour-EndHour"`
      }
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    locationPreference: {
      type: String,
      enum: ['clinic', 'home_visit', 'both'],
      default: 'clinic',
    },
    clinicAddress: {
      type: String,
      default: '',
    },
    appointmentDuration: {
      type: Number,
      default: 30, // minutes
    },
    bookingFee: {
      type: Number,
      default: 500, // NPR
    },
    profileImage: {
      public_id: String,
      url: String,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
DoctorSchema.pre<IDoctor>('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
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
DoctorSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error as any);
  }
};

// Create and export the Doctor model
const Doctor: Model<IDoctor> = mongoose.model<IDoctor>('Doctor', DoctorSchema);

export default Doctor; 
import mongoose, { Document, Schema } from 'mongoose';

export interface IAppointment extends Document {
  user: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  date: Date;
  timeSlot: string;
  petName: string;
  petType: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  locationPreference: 'clinic' | 'home_visit';
  address?: string;
  appointmentDuration: number; // in minutes
  payment: {
    status: 'pending' | 'paid' | 'refunded';
    amount: number;
    transactionId?: string;
    method?: 'cash' | 'card' | 'khalti' | 'esewa';
    paidAt?: Date;
  };
  createdAt: Date;
}

const appointmentSchema = new Schema<IAppointment>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  doctor: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Doctor is required']
  },
  date: {
    type: Date,
    required: [true, 'Appointment date is required']
  },
  timeSlot: {
    type: String,
    required: [true, 'Time slot is required']
  },
  petName: {
    type: String,
    required: [true, 'Pet name is required'],
    trim: true
  },
  petType: {
    type: String,
    required: [true, 'Pet type is required'],
    trim: true
  },
  reason: {
    type: String,
    required: [true, 'Reason for appointment is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  locationPreference: {
    type: String,
    enum: ['clinic', 'home_visit'],
    required: [true, 'Location preference is required']
  },
  address: {
    type: String,
    trim: true
  },
  appointmentDuration: {
    type: Number,
    default: 30, // Default to 30 minutes
    required: [true, 'Appointment duration is required']
  },
  payment: {
    status: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending'
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required']
    },
    transactionId: String,
    method: {
      type: String,
      enum: ['cash', 'card', 'khalti', 'esewa']
    },
    paidAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IAppointment>('Appointment', appointmentSchema); 
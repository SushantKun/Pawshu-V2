import express, { Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Doctor, { IDoctor } from '../models/Doctor';
import Appointment from '../models/Appointment';
import { verifyToken, doctorAuth, AuthRequest } from '../middleware/auth';
import { uploadImage } from '../utils/cloudinary';

const router = express.Router();

// @route   POST /api/doctors/login
// @desc    Login doctor
// @access  Public
router.post('/login', (async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find doctor by email
    const doctor = await Doctor.findOne({ email }).select('+password');
    if (!doctor) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await doctor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { id: doctor._id, role: 'doctor' },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    // Return token and doctor info (excluding password)
    const doctorInfo = {
      id: doctor._id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.email,
      specialization: doctor.specialization
    };

    res.json({ token, doctor: doctorInfo });
  } catch (error) {
    console.error('Doctor login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Get doctor profile
router.get('/profile', verifyToken, doctorAuth, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const doctor = await Doctor.findById(req.user._id).select('-password');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Update doctor profile
router.put('/profile', verifyToken, doctorAuth, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Update doctor fields
    const updates = req.body;
    Object.keys(updates).forEach((update) => {
      if (update !== '_id' && update !== 'password') {
        (doctor as any)[update] = updates[update];
      }
    });

    await doctor.save();
    const updatedDoctor = await Doctor.findById(req.user._id).select('-password');
    res.json(updatedDoctor);
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Get all doctors
router.get('/', (async (req: Request, res: Response) => {
  try {
    const doctors = await Doctor.find().select('-password');
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Get doctor by ID
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('-password');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.json(doctor);
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Get doctor's appointments
router.get('/appointments', verifyToken, doctorAuth, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const appointments = await Appointment.find({ doctor: req.user._id })
      .populate('user', 'name email')
      .sort({ date: 1 });
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Get available time slots for a doctor on a specific date
router.get('/available-slots/:doctorId/:date', (async (req: Request, res: Response) => {
  try {
    const { doctorId, date } = req.params;

    if (!doctorId || !date) {
      return res.status(400).json({ message: 'Doctor ID and date are required' });
    }

    // Find doctor to get their availability
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Get day of week from date
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    
    // Filter doctor's availability for the given day
    const availablePeriods = doctor.availability.filter(slot => 
      slot.includes(dayOfWeek.split(',')[0])
    );

    // Define all possible time slots
    const morningSlots = ['9:00 AM', '10:00 AM', '11:00 AM'];
    const afternoonSlots = ['1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
    
    // Determine available slots based on doctor's availability
    let availableSlots: string[] = [];
    
    if (availablePeriods.includes(`${dayOfWeek} Morning`)) {
      availableSlots = [...availableSlots, ...morningSlots];
    }
    
    if (availablePeriods.includes(`${dayOfWeek} Afternoon`)) {
      availableSlots = [...availableSlots, ...afternoonSlots];
    }

    // Find booked appointments for this doctor on this date
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      date: new Date(date),
      status: { $ne: 'cancelled' } // Exclude cancelled appointments
    });

    // Remove booked slots
    const bookedSlots = bookedAppointments.map(appointment => appointment.timeSlot);
    const finalAvailableSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));

    res.json({ availableSlots: finalAvailableSlots });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

export default router; 
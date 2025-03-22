import express, { Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Doctor, { IDoctor } from '../models/Doctor';
import Appointment from '../models/Appointment';
import { verifyToken, doctorAuth, AuthRequest } from '../middleware/auth';
import { uploadImage } from '../utils/cloudinary';
import mongoose from 'mongoose';

const router = express.Router();

// @route   POST /api/doctors/login
// @desc    Login doctor
// @access  Public
router.post('/login', (async (req: Request, res: Response) => {
  try {
    console.log('POST /api/doctors/login - Doctor login attempt');
    const { email, password } = req.body;
    
    console.log('Login attempt for email:', email);

    // Validate input
    if (!email || !password) {
      console.log('Missing email or password in request');
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find doctor by email
    const doctor = await Doctor.findOne({ email }).select('+password');
    console.log('Doctor found:', doctor ? `ID: ${doctor._id}, Email: ${doctor.email}` : 'No doctor found');
    
    if (!doctor) {
      console.log('No doctor found with email:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    try {
      const isMatch = await doctor.comparePassword(password);
      console.log('Password match:', isMatch);
      
      if (!isMatch) {
        console.log('Invalid password for doctor:', email);
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (passwordError) {
      console.error('Error comparing password:', passwordError);
      return res.status(500).json({ message: 'Error validating credentials' });
    }

    // Create token
    const token = jwt.sign(
      { 
        _id: doctor._id,
        name: `${doctor.firstName} ${doctor.lastName}`,
        email: doctor.email,
        isAdmin: false,
        role: 'doctor'
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    // Return token and doctor info (excluding password)
    const doctorInfo = {
      _id: doctor._id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.email,
      specialization: doctor.specialization,
      role: 'doctor'
    };

    console.log('Doctor login successful for:', email);
    res.json({ token, doctor: doctorInfo });
  } catch (error) {
    console.error('Doctor login error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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

// Update doctor password
router.put('/profile/password', verifyToken, doctorAuth, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }

    // Find doctor with password field
    const doctor = await Doctor.findById(req.user._id).select('+password');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Verify current password
    const isMatch = await doctor.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    doctor.password = newPassword;
    await doctor.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating doctor password:', error);
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

// Get doctor's appointments
router.get('/appointments', verifyToken as RequestHandler, doctorAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    console.log('Fetching appointments for doctor:', req.user._id);

    const appointments = await Appointment.find({ doctor: req.user._id })
      .populate('user', 'name email')
      .sort({ date: 1 });
    
    console.log('Found appointments:', appointments.length);
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

// @route   GET /api/doctors/dashboard-stats
// @desc    Get dashboard statistics for the logged-in doctor
// @access  Private (Doctor only)
router.get('/dashboard-stats', doctorAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/doctors/dashboard-stats - Fetching doctor dashboard statistics');
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB connection is not ready. State:', mongoose.connection.readyState);
      return res.status(500).json({ 
        message: 'Database connection is not available',
        mongodbUri: process.env.MONGODB_URI ? 'URI defined' : 'URI not defined'
      });
    }
    
    const doctorId = req.user._id;
    console.log(`Fetching stats for doctor: ${doctorId}`);
    
    // Get doctor details
    const doctor = await Doctor.findById(doctorId).select('-password');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Get appointment counts by status
    const appointmentCounts = await Appointment.aggregate([
      {
        $match: { doctor: new mongoose.Types.ObjectId(doctorId) }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Helper function to get count by status
    function getCountByStatus(counts: any[], status: string): number {
      const statusItem = counts.find(item => item._id === status);
      return statusItem ? statusItem.count : 0;
    }
    
    // Calculate appointment statistics
    const appointmentStats = {
      total: await Appointment.countDocuments({ doctor: doctorId }),
      pending: getCountByStatus(appointmentCounts, 'pending'),
      confirmed: getCountByStatus(appointmentCounts, 'confirmed'),
      completed: getCountByStatus(appointmentCounts, 'completed'),
      cancelled: getCountByStatus(appointmentCounts, 'cancelled')
    };
    
    // Get recent appointments
    const recentAppointments = await Appointment.find({ doctor: doctorId })
      .populate('user', 'name email')
      .sort({ date: -1 }) // Sort by date descending to get most recent first
      .limit(5);
    
    // Ensure all user references are valid
    const safeRecentAppointments = recentAppointments.map(appt => {
      // Create a safe version of the appointment
      const appointment = appt.toObject();
      
      // Ensure user object exists
      if (!appointment.user) {
        // Use type assertion to specify the user shape
        appointment.user = { 
          _id: new mongoose.Types.ObjectId(),
          name: 'Unknown Patient', 
          email: 'No email' 
        } as any; // Use type assertion to bypass TypeScript checking
      }
      
      return appointment;
    });
    
    // Get monthly appointment trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const appointmentTrends = await Appointment.aggregate([
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    // Get appointment completion rate data
    const completionRateData = await Appointment.aggregate([
      {
        $match: { 
          doctor: new mongoose.Types.ObjectId(doctorId),
          status: { $in: ['completed', 'cancelled'] }
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          completed: {
            $sum: { 
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] 
            }
          },
          cancelled: {
            $sum: { 
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] 
            }
          },
          total: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 1,
          completed: 1,
          cancelled: 1,
          total: 1,
          completionRate: {
            $multiply: [
              { $divide: ['$completed', { $max: ['$total', 1] }] },
              100
            ]
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    // Format the data for response
    const dashboardData = {
      doctorInfo: {
        _id: doctor._id,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        specialization: doctor.specialization,
        experience: doctor.experience,
        profileImage: doctor.profileImage
      },
      appointmentStats,
      recentAppointments: safeRecentAppointments,
      appointmentTrends,
      completionRateData,
      performanceMetrics: {
        completionRate: appointmentStats.total > 0 
          ? (appointmentStats.completed / appointmentStats.total * 100).toFixed(1) 
          : 0,
        cancellationRate: appointmentStats.total > 0
          ? (appointmentStats.cancelled / appointmentStats.total * 100).toFixed(1)
          : 0
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching doctor dashboard stats:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Get doctor by ID - This route must come after all other GET routes that use specific paths
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    console.log(`GET /api/doctors/${req.params.id} - Fetching doctor by ID`);
    
    // Check if the parameter could be a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`Invalid doctor ID format: ${req.params.id}`);
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }
    
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

export default router; 
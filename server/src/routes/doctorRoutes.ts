import express, { Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Doctor, { IDoctor } from '../models/Doctor';
import Appointment from '../models/Appointment';
import { verifyToken, doctorAuth } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import { uploadImage } from '../utils/cloudinary';
import mongoose from 'mongoose';

const router = express.Router();

// Helper function to validate date format (YYYY-MM-DD)
const isValidDate = (dateString: string): boolean => {
  // Check if it's a valid string and matches YYYY-MM-DD format
  if (typeof dateString !== 'string') return false;

  // Check if matches YYYY-MM-DD format
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  // Check if it's a valid date
  const date = new Date(dateString);
  const timestamp = date.getTime();
  if (isNaN(timestamp)) return false;

  return true;
};

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
        isDoctor: true,
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
      isDoctor: true,
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
    console.log('Doctor authorization successful for path: /profile');
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Debug request body
    console.log('Profile update request body keys:', Object.keys(req.body));
    console.log('Profile update request body availability:', req.body.availability);
    console.log('Profile update request body availability[]:', req.body['availability[]']);

    // Create a clean update object
    const updates: Partial<IDoctor> = {};
    
    // Handle basic fields
    const fields = [
      'firstName', 'lastName', 'specialization', 
      'experience', 'bio', 'isActive', 'locationPreference',
      'clinicAddress', 'appointmentDuration', 'bookingFee'
    ];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        (updates as any)[field] = req.body[field];
      }
    });
    
    // Special handling for availability array
    console.log('Received availability data:', req.body.availability);
    console.log('Received availability[] data:', req.body['availability[]']);
    
    // Handle availability array specifically 
    if (req.body.availability || req.body['availability[]']) {
      // For form data, the field might be passed as 'availability[]'
      let availabilityData = req.body.availability;
      
      // If it's not an array but we have availability[], use that instead
      if (!Array.isArray(availabilityData) && req.body['availability[]']) {
        availabilityData = req.body['availability[]'];
        console.log('Using availability[] instead:', availabilityData);
      }
      
      // Process the availability data - make sure we handle all cases
      if (Array.isArray(availabilityData)) {
        // Filter out any empty strings
        updates.availability = availabilityData.filter((slot: string) => slot && slot.trim() !== '');
        console.log('Using availability array with entries:', updates.availability);
      } else if (typeof availabilityData === 'string' && availabilityData.trim() !== '') {
        // Single string case
        updates.availability = [availabilityData];
        console.log('Using single availability string:', updates.availability);
      } else if (availabilityData === undefined || availabilityData === null) {
        // Empty case - set to empty array to clear existing
        updates.availability = [];
        console.log('Clearing availability array - no data provided');
      }
      
      // Ensure each entry is correctly formatted as 'Day StartHour-EndHour'
      if (updates.availability && updates.availability.length > 0) {
        updates.availability = updates.availability.map((slot: string) => {
          // Check if already in correct format
          if (/^[A-Z][a-z]+ \d+-\d+$/.test(slot)) {
            return slot;
          }
          
          // Try to parse and reformat if needed
          const parts = slot.split(' ');
          if (parts.length >= 2) {
            const day = parts[0];
            const timeRange = parts[1];
            if (timeRange.includes('-')) {
              return `${day} ${timeRange}`;
            }
          }
          return slot;
        });
      }

      console.log('Final processed availability:', updates.availability);
    } else {
      // If availability is not provided at all, leave it as is
      console.log('No availability data provided, leaving existing values');
    }
    
    // Handle profile image separately to prevent validation errors
    if (req.body.profileImage) {
      // If it's a data URL, upload to Cloudinary
      if (typeof req.body.profileImage === 'string' && req.body.profileImage.startsWith('data:')) {
        try {
          const uploadResult = await uploadImage(req.body.profileImage);
          updates.profileImage = {
            public_id: uploadResult.public_id,
            url: uploadResult.secure_url
          };
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          return res.status(400).json({ message: 'Error uploading profile image' });
        }
      } else if (typeof req.body.profileImage === 'object') {
        // If it's already an object with the right structure, use it directly
        updates.profileImage = req.body.profileImage;
      }
      // Otherwise ignore it to prevent validation errors
    }
    
    console.log('Doctor profile update object:', { 
      ...updates, 
      profileImage: updates.profileImage ? 'image data present' : 'no image data',
      availability: updates.availability
    });
    
    // Apply updates
    Object.keys(updates).forEach((key) => {
      if (key !== '_id' && key !== 'password' && key !== 'email') {
        (doctor as any)[key] = (updates as any)[key];
      }
    });

    await doctor.save();
    
    const updatedDoctor = await Doctor.findById(req.user._id).select('-password');
    res.json(updatedDoctor);
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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

// @route   GET /api/doctors/available-slots/:doctorId/:date
// @desc    Get available time slots for a doctor on a specific date
// @access  Public
router.get('/available-slots/:doctorId/:date', (async (req: Request, res: Response) => {
  try {
    const { doctorId, date } = req.params;

    if (!doctorId || !date) {
      return res.status(400).json({ message: 'Doctor ID and date are required' });
    }

    // Validate date format and handle potential [object Object]
    if (date === '[object Object]' || !isValidDate(date)) {
      return res.status(400).json({
        message: 'Invalid date format. Please provide a valid date (YYYY-MM-DD)',
        receivedDate: date
      });
    }

    // Find doctor to get their availability
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Check if doctor is active
    if (!doctor.isActive) {
      return res.status(400).json({ message: 'This doctor is currently not available for booking' });
    }

    // Get day of week from date
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

    // Calculate available slots based on the new availability format
    let availableSlots: string[] = [];

    // Filter availability for the current day
    const daySlots = doctor.availability
      .filter(slot => slot.startsWith(dayOfWeek))
      .map(slot => {
        const parts = slot.split(' ');
        if (parts.length >= 2) {
          const timeRange = parts[1];
          const [startHour, endHour] = timeRange.split('-').map(t => parseInt(t));
          return { startHour, endHour };
        }
        return null;
      })
      .filter(slot => slot !== null);

    // Generate hourly time slots from the availability ranges
    daySlots.forEach(slot => {
      if (slot) {
        for (let hour = slot.startHour; hour < slot.endHour; hour++) {
          const formattedHour = hour < 12
            ? `${hour}:00 AM`
            : hour === 12
              ? `12:00 PM`
              : `${hour - 12}:00 PM`;
          availableSlots.push(formattedHour);
        }
      }
    });

    // Find booked appointments for this doctor on this date
    const targetDate = new Date(date);
    // Set time to midnight for date comparison
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      date: {
        $gte: targetDate,
        $lt: nextDay
      },
      status: { $ne: 'cancelled' } // Exclude cancelled appointments
    });

    // Remove booked slots
    const bookedSlots = bookedAppointments.map(appointment => appointment.timeSlot);
    const finalAvailableSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));

    // Return available slots and location information
    res.json({
      availableSlots: finalAvailableSlots,
      locationPreference: doctor.locationPreference,
      appointmentDuration: doctor.appointmentDuration || 30, // Default to 30 minutes if not specified
      clinicAddress: doctor.locationPreference !== 'home_visit' ? doctor.clinicAddress : undefined
    });
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

// @route   PUT /api/doctors/active-status
// @desc    Update the doctor's active status
// @access  Private (Doctor)
router.put('/active-status', verifyToken, doctorAuth, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('PUT /api/doctors/active-status - Updating active status');

    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Toggle active status if not provided, or set to the provided value
    const { isActive } = req.body;
    doctor.isActive = isActive !== undefined ? isActive : !doctor.isActive;

    await doctor.save();

    console.log(`Doctor ${req.user._id} active status updated to: ${doctor.isActive}`);

    res.json({
      message: `Active status ${doctor.isActive ? 'enabled' : 'disabled'} successfully`,
      isActive: doctor.isActive
    });
  } catch (error) {
    console.error('Error updating doctor active status:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// @route   GET /api/doctors/default-time-slots
// @desc    Get default time slots for doctors
// @access  Private (Doctor)
router.get('/default-time-slots', verifyToken, doctorAuth, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/doctors/default-time-slots - Getting default time slots');

    // Create default time slots for each day of the week
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const defaultTimeSlots: string[] = [];

    // Add standard business hours by default
    const timeRanges = [
      { start: 9, end: 12 },   // Morning
      { start: 13, end: 17 }   // Afternoon
    ];

    days.forEach(day => {
      timeRanges.forEach(range => {
        defaultTimeSlots.push(`${day} ${range.start}-${range.end}`);
      });
    });

    res.json({
      message: 'Default time slots retrieved successfully',
      defaultTimeSlots
    });
  } catch (error) {
    console.error('Error getting default time slots:', error);
    res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

export default router; 
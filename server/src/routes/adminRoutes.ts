import express, { Request, Response, RequestHandler } from 'express';
import Doctor, { IDoctor } from '../models/Doctor';
import { adminAuth } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import { uploadImage } from '../utils/cloudinary';
import User from '../models/User';
import Appointment from '../models/Appointment';
import Donation from '../models/Donation';
import { Charity } from '../models/Charity';
import Order from '../models/Order';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import Product from '../models/Product';
import { createDoctor, getAllDoctors, getDoctorById, updateDoctor, deleteDoctor } from '../controllers/adminController';
import { updateOrderStatus } from '../controllers/orderController';

const router = express.Router();

// @route   POST /api/admin/doctors
// @desc    Create a new doctor
// @access  Private (Admin only)
router.post('/doctors', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('POST /api/admin/doctors - Creating new doctor');
    
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    // Extract doctor data from request body
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      specialization, 
      experience, 
      bio, 
      availability,
      locationPreference,
      clinicAddress,
      appointmentDuration,
      profileImage 
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !password || !specialization) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    // Check if doctor with email already exists
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({ message: 'A doctor with this email already exists' });
    }
    
    // Validate availability format if provided
    if (availability && Array.isArray(availability)) {
      // Check each availability string follows the format "Day startHour-endHour"
      for (const avail of availability) {
        if (typeof avail !== 'string') {
          return res.status(400).json({ 
            message: 'Invalid availability format. Each entry must be a string.',
            example: 'Monday 9-12'
          });
        }
        
        const parts = avail.split(' ');
        if (parts.length < 2) {
          return res.status(400).json({ 
            message: 'Invalid availability format. Format should be "Day startHour-endHour"',
            example: 'Monday 9-12'
          });
        }
        
        const day = parts[0];
        const timeRange = parts[1];
        
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (!validDays.includes(day)) {
          return res.status(400).json({ 
            message: `Invalid day: ${day}. Must be one of: ${validDays.join(', ')}` 
          });
        }
        
        if (!timeRange.includes('-')) {
          return res.status(400).json({ 
            message: 'Invalid time range format. Format should be "startHour-endHour"',
            example: '9-12'
          });
        }
        
        const [startHourStr, endHourStr] = timeRange.split('-');
        const startHour = parseInt(startHourStr);
        const endHour = parseInt(endHourStr);
        
        // Validate that the values are actually numbers
        if (isNaN(startHour) || isNaN(endHour)) {
          return res.status(400).json({ 
            message: 'Invalid time range format. Hours must be numbers.',
            example: '9-12',
            received: timeRange
          });
        }
        
        if (startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24) {
          return res.status(400).json({ 
            message: 'Invalid hours in time range. Hours must be between 0-23.',
            example: '9-12'
          });
        }
        
        if (startHour >= endHour) {
          return res.status(400).json({ 
            message: 'Start hour must be before end hour',
            example: '9-12'
          });
        }
      }
    }
    
    // Create new doctor with all the provided fields
    const doctorData: Partial<IDoctor> = {
      firstName,
      lastName,
      email,
      password,
      specialization,
      experience: experience || 0,
      bio: bio || '',
      availability: availability || [],
      locationPreference: locationPreference || 'clinic',
      clinicAddress: clinicAddress || '',
      appointmentDuration: appointmentDuration || 30,
      isActive: true
    };
    
    console.log(`Creating new doctor with email: ${email}`);
    
    // Handle profile image if provided
    if (profileImage && typeof profileImage === 'string' && profileImage.startsWith('data:image/')) {
      try {
        const uploadResult = await uploadImage(profileImage);
        doctorData.profileImage = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url
        };
      } catch (imageError) {
        console.error('Error uploading profile image:', imageError);
        // Continue with doctor creation even if image upload fails
      }
    }
    
    const newDoctor = new Doctor(doctorData);
    await newDoctor.save();
    
    // Remove password from response
    const doctorResponse = newDoctor.toObject();
    const { password: _, ...doctorWithoutPassword } = doctorResponse;
    
    console.log(`Doctor created successfully with ID: ${newDoctor._id}`);
    res.status(201).json(doctorWithoutPassword);
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}) as RequestHandler);

// @route   GET /api/admin/doctors
// @desc    Get all doctors
// @access  Private (Admin only)
router.get('/doctors', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/admin/doctors - Fetching all doctors');
    const doctors = await Doctor.find().select('-password');
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// @route   GET /api/admin/doctors/:id
// @desc    Get doctor by ID
// @access  Private (Admin only)
router.get('/doctors/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`GET /api/admin/doctors/${req.params.id} - Fetching doctor by ID`);
    const doctor = await Doctor.findById(req.params.id).select('-password');
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    res.json(doctor);
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// @route   PUT /api/admin/doctors/:id
// @desc    Update a doctor by ID
// @access  Private (Admin only)
router.put('/doctors/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('PUT /api/admin/doctors/:id - Updating doctor');
    
    // Check if the request is authenticated as admin (this is redundant since adminAuth middleware already does this)
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const doctorId = req.params.id;
    const updateData = req.body;
    
    // Validate doctor ID
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }
    
    // Find doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Update time slot validation logic in the PUT route
    if (updateData.availability && Array.isArray(updateData.availability)) {
      console.log('Validating availability:', updateData.availability);
      // Check each availability string follows the format "Day startHour-endHour"
      for (const avail of updateData.availability) {
        if (typeof avail !== 'string') {
          return res.status(400).json({ 
            message: 'Invalid availability format. Each entry must be a string.',
            example: 'Monday 9-12',
            received: typeof avail
          });
        }
        
        const parts = avail.split(' ');
        if (parts.length < 2) {
          return res.status(400).json({ 
            message: 'Invalid availability format. Format should be "Day startHour-endHour"',
            example: 'Monday 9-12',
            received: avail
          });
        }
        
        const day = parts[0];
        const timeRange = parts[1];
        
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (!validDays.includes(day)) {
          return res.status(400).json({ 
            message: `Invalid day: ${day}. Must be one of: ${validDays.join(', ')}`,
            received: avail
          });
        }
        
        if (!timeRange.includes('-')) {
          return res.status(400).json({ 
            message: 'Invalid time range format. Format should be "startHour-endHour"',
            example: '9-12',
            received: timeRange
          });
        }
        
        const [startHourStr, endHourStr] = timeRange.split('-');
        
        // Make sure both parts exist
        if (!startHourStr || !endHourStr) {
          return res.status(400).json({ 
            message: 'Invalid time range format. Both start and end hour must be provided.',
            example: '9-12',
            received: timeRange
          });
        }
        
        const startHour = parseInt(startHourStr);
        const endHour = parseInt(endHourStr);
        
        // Validate that the values are actually numbers
        if (isNaN(startHour) || isNaN(endHour)) {
          return res.status(400).json({ 
            message: 'Invalid time range format. Hours must be numbers.',
            example: '9-12',
            received: timeRange
          });
        }
        
        if (startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24) {
          return res.status(400).json({ 
            message: 'Invalid hours in time range. Hours must be between 0-23.',
            example: '9-12',
            received: timeRange
          });
        }
        
        if (startHour >= endHour) {
          return res.status(400).json({ 
            message: 'Start hour must be before end hour',
            example: '9-12',
            received: timeRange
          });
        }
      }
      
      console.log('Availability validation passed successfully');
    }
    
    // Update doctor with provided fields (except password which is handled separately)
    const fieldsToUpdate = {...updateData};
    delete fieldsToUpdate.password; // Remove password from the general update
    
    console.log(`Updating doctor ${doctorId} with data:`, {
      ...fieldsToUpdate,
      password: updateData.password ? '[PASSWORD FIELD PRESENT]' : '[NO PASSWORD]' 
    });
    
    // Update fields
    Object.keys(fieldsToUpdate).forEach(key => {
      if (key !== '_id') { // Skip the _id field
        (doctor as any)[key] = fieldsToUpdate[key];
      }
    });
    
    // Handle password update if provided
    if (updateData.password) {
      // Password will be automatically hashed by the pre-save hook in the model
      doctor.password = updateData.password;
    }
    
    await doctor.save();
    
    // Return updated doctor without password
    const updatedDoctor = await Doctor.findById(doctorId).select('-password');
    
    console.log(`Doctor ${doctorId} updated successfully`);
    res.json(updatedDoctor);
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// @route   DELETE /api/admin/doctors/:id
// @desc    Delete doctor
// @access  Private (Admin only)
router.delete('/doctors/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`DELETE /api/admin/doctors/${req.params.id} - Deleting doctor`);
    const doctor = await Doctor.findById(req.params.id);
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    await Doctor.deleteOne({ _id: req.params.id });
    console.log('Doctor deleted successfully:', req.params.id);
    
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Simple admin status check route
router.get('/check-status', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      status: 'success',
      message: 'Admin authentication successful',
      user: req.user
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Get dashboard statistics
router.get('/dashboard-stats', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/admin/dashboard-stats - Fetching real MongoDB dashboard statistics');
    
    // Helper function to get count by status
    function getCountByStatus(counts: any[], status: string): number {
      const statusItem = counts.find(item => item._id === status);
      return statusItem ? statusItem.count : 0;
    }
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB connection is not ready. State:', mongoose.connection.readyState);
      return res.status(500).json({ 
        message: 'Database connection is not available',
        mongodbUri: process.env.MONGODB_URI ? 'URI defined' : 'URI not defined'
      });
    }
    
    // Get real counts from MongoDB
    const userCount = await User.countDocuments();
    const doctorCount = await Doctor.countDocuments();
    
    // Get appointment stats
    const appointmentCounts = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const appointmentStats = {
      total: await Appointment.countDocuments(),
      pending: getCountByStatus(appointmentCounts, 'pending'),
      confirmed: getCountByStatus(appointmentCounts, 'confirmed'),
      completed: getCountByStatus(appointmentCounts, 'completed'),
      cancelled: getCountByStatus(appointmentCounts, 'cancelled')
    };
    
    // Get charity stats
    const charityCount = await Charity.countDocuments();
    
    // Get donation stats
    const donationStats = await Donation.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' }
        }
      }
    ]).then(result => result[0] || { totalAmount: 0, count: 0, maxAmount: 0, minAmount: 0 });
    
    // Calculate average donation amount
    donationStats.avgAmount = donationStats.count > 0 
      ? Math.round(donationStats.totalAmount / donationStats.count) 
      : 0;
    
    // Get order stats
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]).then(result => result[0] || { total: 0, revenue: 0 });
    
    // Get recent orders
    const recentOrders = await Order.find()
      .populate('userId', 'firstName lastName name email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get recent appointments
    const recentAppointments = await Appointment.find()
      .populate('user', 'firstName lastName name email')
      .populate('doctor', 'firstName lastName specialization')
      .sort({ createdAt: -1 })
      .limit(5);
      
    // Get recent users
    const recentUsers = await User.find()
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get recent donations
    const recentDonations = await Donation.find()
      .populate('userId', 'name')
      .populate('charityId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
      
    // Format recent donations for response
    const formattedDonations = recentDonations.map(donation => ({
      _id: donation._id,
      userName: donation.userId && typeof donation.userId === 'object' && 'name' in donation.userId ? donation.userId.name : 'Anonymous',
      charityName: donation.charityId && typeof donation.charityId === 'object' && 'name' in donation.charityId ? donation.charityId.name : 'Unknown Charity',
      amount: donation.amount,
      date: donation.createdAt,
      status: donation.status
    }));
    
    // Build the dashboard data response with real MongoDB data
    const dashboardData = {
      counts: {
        users: userCount,
        doctors: doctorCount,
        appointments: appointmentStats,
        charities: charityCount,
        donations: donationStats,
        orders: orderStats
      },
      revenue: orderStats.revenue || 0,
      revenueData: generateSampleTimeSeries(6, 1000, 7000), // Still use generated time series data
      userGrowthData: generateSampleTimeSeries(6, 2, 10, 'users'), // Still use generated time series data
      recentOrders: recentOrders,
      trends: {
        monthlyDonations: generateSampleMonthlyData(6, 500, 2000), // Still use generated trends
        monthlyAppointments: generateSampleMonthlyAppointments(6) // Still use generated trends
      },
      recent: {
        donations: formattedDonations,
        appointments: recentAppointments,
        users: recentUsers,
        orders: recentOrders
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      message: 'Error providing dashboard statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Get detailed statistics for charts
router.get('/chart-stats', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/admin/chart-stats - Fetching real chart statistics');
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB connection is not ready. State:', mongoose.connection.readyState);
      return res.status(500).json({ 
        message: 'Database connection is not available',
        mongodbUri: process.env.MONGODB_URI ? 'URI defined' : 'URI not defined'
      });
    }

    // Get real monthly user registrations
    const userRegistrationTrends = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 6 }
    ]);

    // Get real monthly order trends
    const orderTrends = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 6 }
    ]);

    // Get real appointment status breakdown
    const appointmentsByStatus = await Appointment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get real donation breakdown by charity
    const donationsByCharity = await Donation.aggregate([
      {
        $lookup: {
          from: "charities",
          localField: "charityId",
          foreignField: "_id",
          as: "charity"
        }
      },
      {
        $unwind: {
          path: "$charity",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: "$charity.name",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: { $ifNull: ["$_id", "Unknown Charity"] },
          totalAmount: 1,
          count: 1
        }
      }
    ]);

    // Prepare and send chart data
    const chartData = {
      userRegistrationTrends: userRegistrationTrends.length > 0 ? userRegistrationTrends : generateSampleMonthlyData(6, 2, 10),
      orderTrends: orderTrends.length > 0 ? orderTrends : generateSampleMonthlyData(6, 2, 7, 'totalAmount', 1500, 7000),
      appointmentsByStatus: appointmentsByStatus.length > 0 ? appointmentsByStatus : [
        { _id: 'pending', count: 10 },
        { _id: 'confirmed', count: 8 },
        { _id: 'completed', count: 7 },
        { _id: 'cancelled', count: 5 }
      ],
      donationsByCharity: donationsByCharity.length > 0 ? donationsByCharity : [
        { _id: 'Animal Welfare Nepal', totalAmount: 8000, count: 5 },
        { _id: 'Pet Rescue Foundation', totalAmount: 12000, count: 7 },
        { _id: 'Street Dogs Nepal', totalAmount: 5000, count: 3 }
      ]
    };

    res.json(chartData);
  } catch (error) {
    console.error('Error fetching chart stats:', error);
    res.status(500).json({ 
      message: 'Error providing chart statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Helper functions to generate dummy data
function generateSampleTimeSeries(months: number, min: number, max: number, valueKey = 'amount'): Array<{date: string, [key: string]: string | number}> {
  const data: Array<{date: string, [key: string]: string | number}> = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(now.getMonth() - i);
    
    const item: {date: string, [key: string]: string | number} = {
      date: `${date.getFullYear()}-${date.getMonth() + 1}`
    };
    item[valueKey] = Math.floor(Math.random() * (max - min + 1)) + min;
    
    data.push(item);
  }
  
  return data;
}

function generateSampleMonthlyData(months: number, min: number, max: number, valueKey = 'count', totalMin = min, totalMax = max): Array<{_id: {year: number, month: number}, [key: string]: any}> {
  const data: Array<{_id: {year: number, month: number}, [key: string]: any}> = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(now.getMonth() - i);
    
    const item: {_id: {year: number, month: number}, [key: string]: any} = {
      _id: {
        year: date.getFullYear(),
        month: date.getMonth() + 1
      }
    };
    
    item[valueKey] = Math.floor(Math.random() * (max - min + 1)) + min;
    
    if (valueKey !== 'totalAmount') {
      item.total = Math.floor(Math.random() * (totalMax - totalMin + 1)) + totalMin;
    } else {
      item.count = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    data.push(item);
  }
  
  return data;
}

function generateSampleMonthlyAppointments(months: number) {
  type AppointmentEntry = {
    _id: { year: number; month: number };
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  
  const data: AppointmentEntry[] = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(now.getMonth() - i);
    
    data.push({
      _id: {
        year: date.getFullYear(),
        month: date.getMonth() + 1
      },
      total: Math.floor(Math.random() * 10) + 5,
      pending: Math.floor(Math.random() * 5),
      confirmed: Math.floor(Math.random() * 5),
      completed: Math.floor(Math.random() * 5),
      cancelled: Math.floor(Math.random() * 3)
    });
  }
  
  return data;
}

function generateSampleOrders(count: number) {
  type OrderEntry = {
    _id: string;
    user: {
      name: string;
    };
    total: number;
    status: string;
  };
  
  const orders: OrderEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    orders.push({
      _id: `order${i+1}`,
      user: {
        name: `Customer ${i+1}`
      },
      total: Math.floor(Math.random() * 1000) + 500,
      status: ['pending', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 4)]
    });
  }
  
  return orders;
}

function generateSampleDonations(count: number) {
  type DonationEntry = {
    _id: string;
    userName: string;
    charityName: string;
    amount: number;
    date: string;
    status: string;
  };
  
  const donations: DonationEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    donations.push({
      _id: `donation${i+1}`,
      userName: `Donor ${i+1}`,
      charityName: `Charity ${Math.floor(Math.random() * 3) + 1}`,
      amount: Math.floor(Math.random() * 5000) + 500,
      date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed'
    });
  }
  
  return donations;
}

function generateSampleAppointments(count: number) {
  type AppointmentEntry = {
    _id: string;
    user: { name: string };
    doctor: { 
      firstName: string;
      lastName: string;
      specialization: string;
    };
    date: string;
    status: string;
  };
  
  const appointments: AppointmentEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    appointments.push({
      _id: `appointment${i+1}`,
      user: { name: `Pet Owner ${i+1}` },
      doctor: { 
        firstName: `Dr. ${['John', 'Jane', 'Mike', 'Sarah', 'David'][Math.floor(Math.random() * 5)]}`,
        lastName: `${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][Math.floor(Math.random() * 5)]}`,
        specialization: ['Cardiology', 'Surgery', 'Dermatology', 'Neurology', 'General'][Math.floor(Math.random() * 5)]
      },
      date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
      status: ['pending', 'confirmed', 'cancelled', 'completed'][Math.floor(Math.random() * 4)]
    });
  }
  
  return appointments;
}

function generateSampleUsers(count: number) {
  type UserEntry = {
    _id: string;
    name: string;
    email: string;
    createdAt: string;
  };
  
  const users: UserEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    users.push({
      _id: `user${i+1}`,
      name: `User ${i+1}`,
      email: `user${i+1}@example.com`,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  return users;
}

// @route   GET /api/admin/detailed-stats
// @desc    Get detailed statistics for admin panel
// @access  Private (Admin only)
router.get('/detailed-stats', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    // Calculate date for 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get user registration trends (last 6 months)
    const userRegistrationTrends = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
          role: 'user'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get appointment distribution by status
    const appointmentsByStatus = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get appointment trends (last 6 months)
    const appointmentTrends = await Appointment.aggregate([
      {
        $match: {
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

    // Get doctor statistics
    const doctorStats = await Doctor.aggregate([
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'doctor',
          as: 'appointments'
        }
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          specialization: 1,
          appointmentCount: { $size: '$appointments' },
          completedAppointments: {
            $size: {
              $filter: {
                input: '$appointments',
                as: 'appointment',
                cond: { $eq: ['$$appointment.status', 'completed'] }
              }
            }
          }
        }
      },
      { $sort: { appointmentCount: -1 } }
    ]);

    // Get donation statistics
    const donationStats = await Donation.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    // Get donation trends (last 6 months)
    const donationTrends = await Donation.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get donation distribution by charity
    const donationsByCharity = await Donation.aggregate([
      {
        $group: {
          _id: '$charityName',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' }
        }
      }
    ]);

    // Get order trends (last 6 months)
    const orderTrends = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get order distribution by status
    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get user activity metrics
    const userActivityMetrics = await User.aggregate([
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'user',
          as: 'appointments'
        }
      },
      {
        $lookup: {
          from: 'donations',
          localField: '_id',
          foreignField: 'userId',
          as: 'donations'
        }
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'userId',
          as: 'orders'
        }
      },
      {
        $group: {
          _id: null,
          totalActiveUsers: {
            $sum: {
              $cond: [
                { $or: [
                  { $gt: [{ $size: '$appointments' }, 0] },
                  { $gt: [{ $size: '$donations' }, 0] },
                  { $gt: [{ $size: '$orders' }, 0] }
                ]},
                1,
                0
              ]
            }
          },
          usersWithAppointments: {
            $sum: { $cond: [{ $gt: [{ $size: '$appointments' }, 0] }, 1, 0] }
          },
          usersWithDonations: {
            $sum: { $cond: [{ $gt: [{ $size: '$donations' }, 0] }, 1, 0] }
          },
          usersWithOrders: {
            $sum: { $cond: [{ $gt: [{ $size: '$orders' }, 0] }, 1, 0] }
          }
        }
      }
    ]);

    // Calculate total revenue (donations + orders)
    const totalDonationAmount = donationStats[0]?.totalAmount || 0;
    const totalOrderAmount = orderStats[0]?.totalAmount || 0;
    const totalRevenue = totalDonationAmount + totalOrderAmount;

    // Compile all statistics
    const detailedStats = {
      userRegistrationTrends,
      appointmentsByStatus,
      appointmentTrends,
      doctorStats,
      donationStats: donationStats[0] || { totalAmount: 0, count: 0, avgAmount: 0 },
      donationTrends,
      donationsByCharity,
      orderStats: orderStats[0] || { totalAmount: 0, count: 0, avgAmount: 0 },
      orderTrends,
      ordersByStatus,
      totalRevenue,
      userActivityMetrics: userActivityMetrics[0] || {
        totalActiveUsers: 0,
        usersWithAppointments: 0,
        usersWithDonations: 0,
        usersWithOrders: 0
      }
    };

    res.json(detailedStats);
  } catch (error) {
    console.error('Error fetching detailed statistics:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Get all charities (admin)
router.get('/charities', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const charities = await Charity.find().sort({ updatedAt: -1 });
    res.json(charities);
  } catch (error) {
    console.error('Error fetching charities:', error);
    res.status(500).json({ message: 'Failed to fetch charities' });
  }
}) as RequestHandler);

// Create new charity
router.post('/charities', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, goal, image } = req.body;
    
    // Upload image to Cloudinary if provided
    let imageData: { public_id: string; url: string; } | null = null;
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      try {
        const uploadResult = await uploadImage(image);
        imageData = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url
        };
      } catch (imageError) {
        console.error('Error uploading charity image:', imageError);
        res.status(500).json({ message: 'Failed to upload image' });
        return;
      }
    }
    
    const charity = new Charity({
      name,
      description,
      image: imageData,
      goal,
      raised: 0
    });

    await charity.save();
    res.status(201).json(charity);
  } catch (error) {
    console.error('Error creating charity:', error);
    res.status(500).json({ message: 'Failed to create charity' });
  }
}) as RequestHandler);

// Update charity
router.put('/charities/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, goal, image } = req.body;

    const charity = await Charity.findById(id);
    if (!charity) {
      res.status(404).json({ message: 'Charity not found' });
      return;
    }

    charity.name = name;
    charity.description = description;
    charity.goal = goal;
    
    // Upload new image to Cloudinary if provided
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      try {
        const uploadResult = await uploadImage(image);
        const processedImageData = {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url
        };
        charity.image = processedImageData;
      } catch (imageError) {
        console.error('Error uploading charity image:', imageError);
        res.status(500).json({ message: 'Failed to upload image' });
        return;
      }
    }
    
    charity.updatedAt = new Date();

    await charity.save();
    res.json(charity);
  } catch (error) {
    console.error('Error updating charity:', error);
    res.status(500).json({ message: 'Failed to update charity' });
  }
}) as RequestHandler);

// Delete charity
router.delete('/charities/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const charity = await Charity.findByIdAndDelete(id);
    
    if (!charity) {
      res.status(404).json({ message: 'Charity not found' });
      return;
    }

    res.json({ message: 'Charity deleted successfully' });
  } catch (error) {
    console.error('Error deleting charity:', error);
    res.status(500).json({ message: 'Failed to delete charity' });
  }
}) as RequestHandler);

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/users', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/admin/users - Fetching all users');
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}) as RequestHandler);

// Create new user (Admin only)
router.post('/users', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('POST /api/admin/users - Creating new user');
    const { firstName, lastName, email, password, role, status } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Validate role
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be either "user" or "admin"' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name: `${firstName} ${lastName}`,
      email,
      password: hashedPassword,
      role: role,
      status: status || 'active'
    });

    await user.save();
    console.log('User created successfully:', user._id);

    // Remove password from response
    const userResponse = user.toObject();
    const { password: _, ...userWithoutPassword } = userResponse;

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Test routes for debugging
router.get('/test', (req: Request, res: Response) => {
  try {
    console.log('GET /api/admin/test - Basic test endpoint');
    return res.json({
      status: 'ok',
      message: 'Server is up and running',
      timestamp: new Date().toISOString(),
      mongoConnected: mongoose.connection.readyState === 1
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Test endpoint failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Admin auth test route
router.get('/test-auth', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/admin/test-auth - Test auth endpoint');
    
    return res.json({
      status: 'success',
      message: 'Admin authentication successful',
      user: req.user,
      timestamp: new Date().toISOString(),
      mongoConnected: mongoose.connection.readyState === 1,
      collections: Object.keys(mongoose.connection.collections),
      env: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || '5000',
        mongodbUri: process.env.MONGODB_URI ? 'URI defined' : 'URI not defined'
      }
    });
  } catch (error) {
    console.error('Test auth endpoint error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Test auth endpoint failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}) as RequestHandler);

// Simple route for health check (no auth)
router.get('/health', (req: Request, res: Response) => {
  try {
    console.log('GET /api/admin/health - Health check');
    return res.json({
      status: 'ok',
      message: 'Server is up and running',
      timestamp: new Date().toISOString(),
      mongoConnected: mongoose.connection.readyState === 1
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all orders (admin only)
router.get('/orders', adminAuth as RequestHandler, async (req: AuthRequest, res: Response) => {
  try {
    console.log('Admin fetching all orders');
    
    // Check MongoDB connection
    if (!mongoose.connection.readyState) {
      console.error('MongoDB connection is not ready');
      return res.status(500).json({ message: 'Database connection error' });
    }
    
    const orders = await Order.find()
      .populate('userId', 'firstName lastName name email')
      .sort({ createdAt: -1 });
    
    console.log(`Fetched ${orders.length} orders for admin`);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders for admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update order status (admin only)
router.put('/orders/:id/status', adminAuth as RequestHandler, updateOrderStatus as RequestHandler);

export default router; 
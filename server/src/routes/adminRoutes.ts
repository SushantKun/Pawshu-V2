import express, { Request, Response, RequestHandler } from 'express';
import Doctor from '../models/Doctor';
import { adminAuth, AuthRequest } from '../middleware/auth';
import { uploadImage } from '../utils/cloudinary';
import User from '../models/User';
import Appointment from '../models/Appointment';
import Donation from '../models/Donation';
import { Charity } from '../models/Charity';
import Order from '../models/Order';
import bcrypt from 'bcrypt';

const router = express.Router();

// @route   POST /api/admin/doctors
// @desc    Create a new doctor
// @access  Private (Admin only)
router.post('/doctors', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log('POST /api/admin/doctors - Creating new doctor');
    
    // Validate request body
    if (!req.body) {
      return res.status(400).json({ message: 'Request body is empty' });
    }
    
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      specialization, 
      experience, 
      bio, 
      availability,
      profileImage 
    } = req.body;
    
    // Validate input
    if (!firstName || !lastName || !email || !password || !specialization) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    try {
      // Check if doctor with this email already exists
      const existingDoctor = await Doctor.findOne({ email });
      if (existingDoctor) {
        return res.status(400).json({ message: 'Doctor with this email already exists' });
      }
      
      // Create new doctor
      const doctor = new Doctor({
        firstName,
        lastName,
        email,
        password,
        specialization,
        experience: experience || 0,
        bio: bio || `${firstName} ${lastName} is a ${specialization} specialist.`,
        availability: availability || []
      });
      
      // Handle profile image upload if provided
      if (profileImage && typeof profileImage === 'string') {
        try {
          const uploadResult = await uploadImage(profileImage);
          if (uploadResult) {
            doctor.profileImage = {
              public_id: uploadResult.public_id,
              url: uploadResult.url
            };
          }
        } catch (imageError) {
          console.error('Error uploading profile image:', imageError);
          // Continue with doctor creation even if image upload fails
        }
      }
      
      await doctor.save();
      console.log('Doctor created successfully:', doctor._id);
      
      // Remove password from response
      const doctorResponse = doctor.toObject();
      const { password: _, ...doctorWithoutPassword } = doctorResponse;
      
      res.status(201).json(doctorWithoutPassword);
    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ 
        message: 'Database error', 
        error: dbError instanceof Error ? dbError.message : 'Unknown database error' 
      });
    }
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
// @desc    Update doctor
// @access  Private (Admin only)
router.put('/doctors/:id', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    console.log(`PUT /api/admin/doctors/${req.params.id} - Updating doctor`);
    const { 
      firstName, 
      lastName, 
      email, 
      specialization, 
      experience, 
      bio, 
      availability,
      profileImage 
    } = req.body;
    
    // Find doctor
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Update fields
    if (firstName) doctor.firstName = firstName;
    if (lastName) doctor.lastName = lastName;
    if (email) doctor.email = email;
    if (specialization) doctor.specialization = specialization;
    if (experience !== undefined) doctor.experience = experience;
    if (bio) doctor.bio = bio;
    if (availability) doctor.availability = availability;
    
    // Handle profile image upload if provided
    if (profileImage && typeof profileImage === 'string' && profileImage.startsWith('data:image/')) {
      try {
        const uploadResult = await uploadImage(profileImage);
        doctor.profileImage = {
          public_id: uploadResult.public_id,
          url: uploadResult.url
        };
      } catch (imageError) {
        console.error('Error uploading profile image:', imageError);
        // Continue with update even if image upload fails
      }
    }
    
    await doctor.save();
    console.log('Doctor updated successfully:', doctor._id);
    
    // Remove password from response
    const doctorResponse = doctor.toObject();
    const { password: _, ...doctorWithoutPassword } = doctorResponse;
    
    res.json(doctorWithoutPassword);
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

// Get dashboard statistics
router.get('/dashboard-stats', adminAuth as RequestHandler, (async (req: AuthRequest, res: Response) => {
  try {
    // Get total users count (excluding admins)
    const totalUsers = await User.countDocuments({ role: 'user' });

    // Get total doctors count
    const totalDoctors = await Doctor.countDocuments();

    // Get total appointments count and stats
    const appointmentStats = await Appointment.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get total donations and stats
    const donationStats = await Donation.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' }
        }
      }
    ]);

    // Get total orders and stats
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get recent donations
    const recentDonations = await Donation.find()
      .sort({ date: -1 })
      .limit(5);

    // Get recent orders
    const recentOrders = await Order.find()
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent appointments
    const recentAppointments = await Appointment.find()
      .populate('user', 'name')
      .populate('doctor', 'firstName lastName specialization')
      .sort({ date: -1 })
      .limit(5);

    // Get recent users
    const recentUsers = await User.find({ role: 'user' })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get total charities count
    const totalCharities = await Charity.countDocuments();

    // Calculate total revenue (donations + orders)
    const totalDonationAmount = donationStats[0]?.totalAmount || 0;
    const totalOrderAmount = orderStats[0]?.revenue || 0;
    const totalRevenue = totalDonationAmount + totalOrderAmount;

    // Prepare response
    const response = {
      counts: {
        users: totalUsers,
        doctors: totalDoctors,
        appointments: appointmentStats[0] || {
          total: 0,
          pending: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0
        },
        charities: totalCharities,
        donations: donationStats[0] || {
          totalAmount: 0,
          count: 0,
          avgAmount: 0,
          maxAmount: 0,
          minAmount: 0
        },
        orders: orderStats[0] || {
          total: 0,
          revenue: 0
        }
      },
      revenue: totalRevenue,
      recent: {
        donations: recentDonations,
        orders: recentOrders,
        appointments: recentAppointments,
        users: recentUsers
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Get detailed statistics for charts
router.get('/chart-stats', adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Calculate date for 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get user registration trends (by month)
    const userRegistrationTrends = await User.aggregate([
      {
        $match: { 
          role: 'user',
          createdAt: { $gte: sixMonthsAgo }
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
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
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

    const statistics = {
      userRegistrationTrends,
      orderTrends
    };

    res.json(statistics);
  } catch (error) {
    console.error('Error fetching chart statistics:', error);
    res.status(500).json({ message: 'Error fetching chart statistics' });
  }
});

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
    let imageData = null;
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      try {
        const uploadResult = await uploadImage(image);
        imageData = {
          public_id: uploadResult.public_id,
          url: uploadResult.url
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
        charity.image = {
          public_id: uploadResult.public_id,
          url: uploadResult.url
        };
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

export default router; 
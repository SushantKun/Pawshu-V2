// Suppress punycode deprecation warning
process.removeAllListeners('warning');

import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fileUpload, { UploadedFile, FileArray } from 'express-fileupload';
import { verifyToken, adminAuth, AuthRequest } from './middleware/auth';
import http from 'http';
import productRoutes from './routes/productRoutes';
import doctorRoutes from './routes/doctorRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import adminRoutes from './routes/adminRoutes';
import donationRoutes from './routes/donations';
import orderRoutes from './routes/orderRoutes';
import { v2 as cloudinary } from 'cloudinary';
import User from './models/User';
import charityRoutes from './routes/charityRoutes';
import { Charity, initialCharities } from './models/Charity';
import lostFoundRoutes from './routes/lostFoundRoutes';
import chatRoutes from './routes/chatRoutes';
import setupSocketIO from './services/ChatService';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const server = http.createServer(app);

// Set up Socket.io
const io = setupSocketIO(server);

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for testing
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
}));

// Configure Cloudinary
console.log('Cloudinary configured successfully with cloud name:', process.env.CLOUDINARY_CLOUD_NAME);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawshu';

// Initialize charities if none exist
const initializeCharities = async () => {
  try {
    const charityCount = await Charity.countDocuments();
    if (charityCount === 0) {
      console.log('No charities found. Initializing with sample data...');
      await Charity.insertMany(initialCharities);
      console.log('Sample charities initialized successfully.');
    }
  } catch (error) {
    console.error('Error initializing charities:', error);
  }
};

// Create admin user if it doesn't exist
const createAdminUser = async () => {
  try {
    // Check if admin user exists
    const adminExists = await User.findOne({ email: 'admin@pawshu.com' });
    if (!adminExists) {
      console.log('Creating default admin user...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const adminUser = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@pawshu.com',
        password: hashedPassword,
        role: 'admin',
        isAdmin: true,
        isDoctor: false,
        verified: true
      });
      
      await adminUser.save();
      console.log('Default admin user created successfully.');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    initializeCharities();
    createAdminUser(); // Create admin user if it doesn't exist
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Routes
// Register
const registerHandler = async (req: Request, res: Response) => {
  try {
    console.log('POST /api/auth/register - Registering new user');
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: 'user',
      isAdmin: false,
      isDoctor: false
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { 
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        isDoctor: user.isDoctor
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        isDoctor: user.isDoctor
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login
const loginHandler = async (req: Request, res: Response) => {
  try {
    console.log('POST /api/auth/login - User login attempt');
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        isDoctor: user.isDoctor,
        phone: user.phone
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        isDoctor: user.isDoctor,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin Login
const adminLoginHandler = async (req: Request, res: Response) => {
  try {
    console.log('POST /api/auth/admin/login - Admin login attempt');
    const { email, password } = req.body;
    
    console.log('Login attempt for email:', email);

    // Check if user exists
    const user = await User.findOne({ email });
    console.log('User found:', user ? {
      _id: user._id,
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    } : 'No');
    
    if (!user) {
      console.log('User not found with email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);
    
    if (!isMatch) {
      console.log('Invalid password for user:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user is admin - both by role and isAdmin flag
    console.log('User admin status:', user.isAdmin, 'User role:', user.role);
    if (!user.isAdmin && user.role !== 'admin') {
      console.log('User is not an admin:', email);
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Create JWT token with explicit admin information
    const token = jwt.sign(
      { 
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: 'admin',
        isAdmin: true,
        isDoctor: user.isDoctor
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    console.log('Admin login successful for:', email);
    res.json({
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: 'admin',
        isAdmin: true,
        isDoctor: user.isDoctor
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Profile
const profileHandler = async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/auth/profile - Fetching user profile');
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Profile
const updateProfileHandler = async (req: AuthRequest, res: Response) => {
  try {
    console.log('PUT /api/auth/profile - Updating user profile');
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const { name, email, phone, address, avatar } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update fields
    if (name) {
      // Split the name into firstName and lastName
      const nameParts = name.split(' ');
      if (nameParts.length > 1) {
        user.firstName = nameParts[0];
        user.lastName = nameParts.slice(1).join(' ');
      } else {
        user.firstName = name;
        user.lastName = '';
      }
    }
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (avatar) user.avatar = avatar;
    
    await user.save();
    
    // Return updated user without password
    const updatedUser = await User.findById(req.user._id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update User Password
const updatePasswordHandler = async (req: AuthRequest, res: Response) => {
  try {
    console.log('PUT /api/auth/profile/password - Updating user password');
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }

    // Find user with password field
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating user password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get All Users
const getAllUsersHandler = async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/auth/users - Fetching all users');
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete User
const deleteUserHandler = async (req: AuthRequest, res: Response) => {
  try {
    console.log(`DELETE /api/auth/users/${req.params.id} - Deleting user`);
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.deleteOne({ _id: req.params.id });
    console.log('User deleted successfully:', req.params.id);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Debug route to check user details
app.get('/api/auth/debug-user/:email', (async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user details without password
    const { password, ...userDetails } = user.toObject();
    res.json(userDetails);
  } catch (error) {
    console.error('Debug user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Update User
const updateUserHandler = async (req: AuthRequest, res: Response) => {
  try {
    console.log(`PUT /api/auth/users/${req.params.id} - Updating user`);
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const { firstName, lastName, email, isAdmin, isDoctor } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (isAdmin !== undefined) user.isAdmin = isAdmin;
    if (isDoctor !== undefined) user.isDoctor = isDoctor;
    
    await user.save();
    
    // Return updated user without password
    const updatedUser = await User.findById(req.params.id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Auth routes
app.post('/api/auth/register', registerHandler as RequestHandler);
app.post('/api/auth/login', loginHandler as RequestHandler);
app.post('/api/auth/admin/login', adminLoginHandler as RequestHandler);
app.get('/api/auth/profile', verifyToken as RequestHandler, profileHandler as RequestHandler);
app.put('/api/auth/profile', verifyToken as RequestHandler, updateProfileHandler as RequestHandler);
app.put('/api/auth/profile/password', verifyToken as RequestHandler, updatePasswordHandler as RequestHandler);
app.get('/api/auth/users', adminAuth as RequestHandler, getAllUsersHandler as RequestHandler);
app.put('/api/auth/users/:id', adminAuth as RequestHandler, updateUserHandler as RequestHandler);
app.delete('/api/auth/users/:id', adminAuth as RequestHandler, deleteUserHandler as RequestHandler);

// API routes
app.use('/api/products', productRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/charities', charityRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/chat', chatRoutes);

// Create admin endpoint - for development only
app.get('/api/create-admin', async (req: Request, res: Response) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }
    
    // Check if admin user exists
    const adminExists = await User.findOne({ email: 'admin@pawshu.com' });
    if (adminExists) {
      // Ensure the admin user has the correct flags
      if (!adminExists.isAdmin || adminExists.role !== 'admin') {
        adminExists.isAdmin = true;
        adminExists.role = 'admin';
        await adminExists.save();
        
        return res.json({ 
          message: 'Admin user updated with correct privileges',
          admin: {
            email: adminExists.email,
            firstName: adminExists.firstName,
            lastName: adminExists.lastName,
            isAdmin: adminExists.isAdmin,
            role: adminExists.role
          } 
        });
      }
      
      return res.json({ 
        message: 'Admin user already exists',
        admin: {
          email: adminExists.email,
          firstName: adminExists.firstName,
          lastName: adminExists.lastName,
          isAdmin: adminExists.isAdmin,
          role: adminExists.role
        } 
      });
    }
    
    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@pawshu.com',
      password: hashedPassword,
      role: 'admin',
      isAdmin: true,
      isDoctor: false,
      verified: true
    });
    
    await adminUser.save();
    
    res.status(201).json({ 
      message: 'Admin user created successfully',
      admin: {
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        isAdmin: adminUser.isAdmin,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload endpoint
app.post('/api/upload', async (req: Request, res: Response) => {
  try {
    const files = req.files as FileArray | null | undefined;
    if (!files) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const uploadedFile = files.file as UploadedFile | UploadedFile[];
    if (!uploadedFile || Array.isArray(uploadedFile)) {
      return res.status(400).json({ message: 'Invalid file upload' });
    }

    const result = await cloudinary.uploader.upload(uploadedFile.tempFilePath, {
      folder: 'pawshu/users',
      use_filename: true,
      unique_filename: false,
    });

    res.json({
      public_id: result.public_id,
      url: result.secure_url
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 
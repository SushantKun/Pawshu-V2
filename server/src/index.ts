// Suppress punycode deprecation warning
process.removeAllListeners('warning');

import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fileUpload, { UploadedFile, FileArray } from 'express-fileupload';
import { verifyToken, adminAuth } from './middleware/auth';
import { AuthRequest } from './types/auth';
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
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import uploadRoutes from './routes/uploadRoutes';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dlxqvj9jp',
  api_key: process.env.CLOUDINARY_API_KEY || '941742512285696',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'cPfxg3Y49IqtyJFao0ZSF5aLC_U'
});

console.log('Cloudinary configuration:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dlxqvj9jp',
  api_key: process.env.CLOUDINARY_API_KEY ? 'PRESENT' : 'NOT SET',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'PRESENT' : 'NOT SET'
});

const app = express();
const server = http.createServer(app);

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
        email: 'admin@pawshu.com',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date(),
        _v: 0,
        avatar: {
          status: 'active',
          firstName: 'Admin',
          lastName: 'User',
          address: '',
          phone: '',
          isAdmin: true,
          isDoctor: false,
          verified: true
        }
      });
      
      await adminUser.save();
      console.log('Default admin user created successfully.');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Create test user if it doesn't exist
const createTestUser = async () => {
  try {
    // Check if test user exists
    const testExists = await User.findOne({ email: 'test@gmail.com' });
    if (!testExists) {
      console.log('Creating default test user...');
      
      // Create new user with exact structure from the JSON
      const testUser = new User({
        _id: new mongoose.Types.ObjectId('67d49fb37ca732eddeca28eb'),
        email: 'test@gmail.com',
        password: '$2b$10$Rw4dYYNMAwQvlJ9RgIJ1MelRj3SkK3m9yY1sNXVCY8OoaU5NiNFWC',
        role: 'user',
        createdAt: new Date('2025-03-14T21:29:23.155Z'),
        __v: 0,
        avatar: {
          public_id: 'pawshu/users/tmp-2-1742587157014',
          url: 'https://res.cloudinary.com/duaa2t6lc/image/upload/v1742587183/pawshu/users/tmp-2-1742587157014.gif'
        },
        status: 'active',
        address: 'adf',
        phone: '1234567890',
        firstName: 'Test',
        lastName: 'Subject',
        isAdmin: false,
        isDoctor: false,
        verified: false
      });
      
      // Force the document to be saved as is, bypassing schema validation if needed
      const result = await mongoose.connection.collection('users').insertOne(testUser);
      console.log('Default test user created successfully.');
    }
  } catch (error) {
    console.error('Error creating test user:', error);
  }
};

// Register handler
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

    // Create new user with properties at top level (NOT in avatar object)
    const userData = {
      email,
      password: hashedPassword,
      role: 'user',
      createdAt: new Date(),
      __v: 0,
      avatar: {
        public_id: '',
        url: ''
      },
      status: 'active',
      address: '',
      phone: '',
      firstName,
      lastName,
      isAdmin: false,
      isDoctor: false,
      verified: false
    };
    
    // Force the document to be saved as is, bypassing schema validation if needed
    const result = await mongoose.connection.collection('users').insertOne(userData);
    
    // Get the created user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(500).json({ message: 'Failed to create user' });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        _id: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    // Return the complete user object with top-level properties
    res.status(201).json({
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login handler
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
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    // Log the user object for debugging
    console.log('Login successful for user:', user);

    // Return the user as is with all properties
    res.json({
      token,
      user
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
    console.log('User found:', user ? user : 'No');
    
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

    // Create JWT token with basic information
    const token = jwt.sign(
      { 
        _id: user._id,
        email: user.email,
        role: 'admin'
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    console.log('Admin login successful for:', email);
    
    // Set the admin role explicitly
    user.role = 'admin';
    user.isAdmin = true;
    
    res.json({
      token,
      user
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// MongoDB connection
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    initializeCharities();
    createAdminUser(); // Create admin user if it doesn't exist
    createTestUser(); // Create test user if it doesn't exist
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Routes
app.post('/api/auth/register', registerHandler as RequestHandler);
app.post('/api/auth/login', loginHandler as RequestHandler);
app.post('/api/auth/admin/login', adminLoginHandler as RequestHandler);

// User profile endpoint
app.get('/api/auth/profile', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return the user object without the password
    const userObj = user.toObject();
    const { password, ...userWithoutPassword } = userObj;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// User profile update endpoint
app.put('/api/auth/profile', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields - only allow certain fields to be updated
    const allowedFields = ['firstName', 'lastName', 'phone', 'address', 'avatar'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // Handle top level fields directly
        (user as any)[field] = req.body[field];
      }
    });

    await user.save();
    
    // Return the updated user object without the password
    const userObj = user.toObject();
    const { password, ...userWithoutPassword } = userObj;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Password update endpoint
app.put('/api/auth/profile/password', verifyToken, (async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error' });
  }
}) as RequestHandler);

// Setup multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    
    cb(new Error('Only image files are allowed!'));
  }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// API routes
app.use('/api/products', productRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/charities', charityRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/upload', verifyToken, uploadRoutes);

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

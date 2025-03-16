import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyToken, adminAuth, AuthRequest } from './middleware/auth';
import productRoutes from './routes/productRoutes';
import doctorRoutes from './routes/doctorRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import adminRoutes from './routes/adminRoutes';
import donationRoutes from './routes/donations';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawshu';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Routes
// Register
const registerHandler = async (req: Request, res: Response) => {
  try {
    console.log('POST /api/auth/register - Registering new user');
    const { name, email, password } = req.body;

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
      name,
      email,
      password: hashedPassword,
      role: 'user'
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { 
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.role === 'admin'
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.role === 'admin'
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
        name: user.name,
        email: user.email,
        isAdmin: user.role === 'admin'
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.role === 'admin'
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
      role: user.role,
      name: user.name
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

    // Check if user is admin
    console.log('User role:', user.role);
    if (user.role !== 'admin') {
      console.log('User is not an admin:', email);
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Create JWT token with explicit role information
    const token = jwt.sign(
      { 
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: true
      },
      process.env.JWT_SECRET || 'defaultsecret',
      { expiresIn: '1d' }
    );

    console.log('Admin login successful for:', email);
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: true
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
    console.error('Users fetch error:', error);
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

// Register routes
app.post('/api/auth/register', registerHandler as RequestHandler);
app.post('/api/auth/login', loginHandler as RequestHandler);
app.post('/api/auth/admin/login', adminLoginHandler as RequestHandler);
app.get('/api/auth/profile', verifyToken as RequestHandler, profileHandler as RequestHandler);
app.get('/api/auth/users', verifyToken as RequestHandler, getAllUsersHandler as RequestHandler);

// Product routes
app.use('/api/products', productRoutes);

// Doctor routes
app.use('/api/doctors', doctorRoutes);

// Appointment routes
app.use('/api/appointments', appointmentRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Donation routes
app.use('/api/donations', donationRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
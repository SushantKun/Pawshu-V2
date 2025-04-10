import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';
import orderRoutes from './routes/orderRoutes';
import donationRoutes from './routes/donations';
import productRoutes from './routes/productRoutes';
import adminRoutes from './routes/adminRoutes';
import doctorRoutes from './routes/doctorRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import uploadRoutes from './routes/uploadRoutes';
import lostFoundRoutes from './routes/lostFoundRoutes';
import charityRoutes from './routes/charityRoutes';
import chatRoutes from './routes/chatRoutes';
import authRoutes from './routes/authRoutes';

dotenv.config();

// Check required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'KHALTI_SECRET_KEY',
  'ESEWA_MERCHANT_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.warn(`⚠️ Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.warn('Some features may not work properly.');
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Log environment status
console.log('Environment configuration:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`- CLIENT_URL: ${process.env.CLIENT_URL || 'not set'}`);
console.log(`- PORT: ${process.env.PORT || '5000 (default)'}`);
console.log(`- Payment gateways: ${
  [
    process.env.KHALTI_SECRET_KEY ? 'Khalti ✓' : 'Khalti ✗',
    process.env.ESEWA_MERCHANT_ID ? 'eSewa ✓' : 'eSewa ✗'
  ].join(', ')
}`);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/charities', charityRoutes);
app.use('/api/chats', chatRoutes);

// Make uploads directory accessible
app.use('/uploads', express.static('uploads'));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('Socket auth token:', socket.handshake.auth.token ? 'Present' : 'Missing');

  socket.on('join_chat', (data) => {
    socket.join(data.chatId);
    console.log(`User ${socket.id} joined chat: ${data.chatId}`);
  });

  socket.on('send_message', (data) => {
    // Ensure we're always using raw IDs for the sender
    const messageToEmit = {
      ...data,
      sender: typeof data.sender === 'object' ? data.sender._id : data.sender
    };
    
    io.to(data.chatId).emit('receive_message', messageToEmit);
    console.log(`Message sent in chat ${data.chatId}: ${data.content}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pawshu')
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Export both app and httpServer
export { app, httpServer }; 
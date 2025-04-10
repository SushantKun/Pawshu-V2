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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  }
});

// Custom CORS middleware to handle all HTTP methods including PATCH
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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

  // Track typing status for each chat and user
  const typingUsers = new Map<string, Set<string>>();
  
  // Join specific chat room
  socket.on('join_chat', (data) => {
    socket.join(data.chatId);
    console.log(`User ${socket.id} joined chat: ${data.chatId}`);
    
    // Notify other participants that user is online
    socket.to(data.chatId).emit('user_online', {
      chatId: data.chatId,
      userId: data.userId
    });
    
    // Send current typing users for this chat
    if (typingUsers.has(data.chatId)) {
      const typingUsersInChat = Array.from(typingUsers.get(data.chatId) || []);
      console.log(`Sending typing users for chat ${data.chatId}:`, typingUsersInChat);
      socket.emit('typing_users', {
        chatId: data.chatId,
        users: typingUsersInChat
      });
    }
  });
  
  // Typing indicators
  socket.on('typing', (data) => {
    console.log(`User ${data.userId} is typing in chat ${data.chatId}`);
    // Add user to typing set for this chat
    if (!typingUsers.has(data.chatId)) {
      typingUsers.set(data.chatId, new Set());
    }
    typingUsers.get(data.chatId)?.add(data.userId);
    console.log(`Typing users in chat ${data.chatId}:`, Array.from(typingUsers.get(data.chatId) || []));
    
    // Broadcast to all users in the chat
    socket.to(data.chatId).emit('typing', {
      chatId: data.chatId,
      userId: data.userId
    });
  });
  
  socket.on('stop_typing', (data) => {
    console.log(`User ${data.userId} stopped typing in chat ${data.chatId}`);
    // Remove user from typing set
    typingUsers.get(data.chatId)?.delete(data.userId);
    console.log(`Typing users in chat ${data.chatId} after stop:`, Array.from(typingUsers.get(data.chatId) || []));
    
    // Broadcast to all users in the chat
    socket.to(data.chatId).emit('stop_typing', {
      chatId: data.chatId,
      userId: data.userId
    });
  });

  // Send message handler
  socket.on('send_message', async (data) => {
    try {
      // First check if the chat is active
      const Chat = mongoose.connection.collection('chats');
      const chat = await Chat.findOne({ _id: new mongoose.Types.ObjectId(data.chatId) });
      
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }
      
      // If this chat is associated with a report, check if the report is resolved
      if (chat.reportId) {
        const LostFound = mongoose.connection.collection('lostfounds');
        const report = await LostFound.findOne({ _id: chat.reportId });
        
        if (report && report.status === 'resolved') {
          console.log(`Message rejected: Report ${chat.reportId} is resolved`);
          socket.emit('error', { message: 'This report has been resolved. Messages cannot be sent.' });
          return;
        }
      }
      
      // Strict check for isActive false (meaning the chat is inactive due to resolved report)
      if (chat.isActive === false) {
        console.log(`Message rejected: Chat ${data.chatId} is inactive (resolved report)`);
        socket.emit('error', { message: 'This chat is inactive due to a resolved report. Messages cannot be sent.' });
        return;
      }
      
      // Ensure we're always using raw IDs for the sender
      const messageToEmit = {
        ...data,
        sender: typeof data.sender === 'object' ? data.sender._id : data.sender
      };
      
      io.to(data.chatId).emit('receive_message', messageToEmit);
      
      // Clear typing state for this user
      typingUsers.get(data.chatId)?.delete(data.userId);
      socket.to(data.chatId).emit('stop_typing', {
        chatId: data.chatId,
        userId: data.userId
      });
      
      // Emit message_status update to all other participants (delivered)
      if (messageToEmit._id) {
        socket.to(data.chatId).emit('message_status_updated', { 
          messageId: messageToEmit._id,
          status: 'delivered'
        });
      }
      
      console.log(`Message sent in chat ${data.chatId}: ${data.content}`);
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up typing status for all chats
    typingUsers.forEach((users, chatId) => {
      // Find and remove the disconnected user from each chat's typing users
      // This is approximate since we don't track user ID to socket ID mapping
      socket.rooms.forEach(room => {
        if (room === chatId) {
          // Notify others in this room that typing has stopped
          socket.to(chatId).emit('typing_users_updated', {
            chatId,
            users: Array.from(users)
          });
        }
      });
    });
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
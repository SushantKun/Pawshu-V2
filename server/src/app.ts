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
import jwt from 'jsonwebtoken';
// Comment out or remove these imports if these routes don't exist yet
// import bookingRoutes from './routes/bookingRoutes';
// import paymentRoutes from './routes/paymentRoutes';
// import docAuthRoutes from './routes/doctorAuthRoutes';
import userRoutes from './routes/userRoutes';
// Comment out or remove cookie-parser if not needed
// import cookieParser from 'cookie-parser';

// Import models
import './models/User'; // Import User model to register it
import './models/Chat'; // Import Chat model to register it
import './models/LostFound'; // Import LostFound model to register it
import './models/Charity'; // Import Charity model to register it

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  pingTimeout: 60000, // 60 seconds timeout
  pingInterval: 25000 // 25 seconds ping interval
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

// Add specific middleware to handle the beacon request before other middleware
app.use('/api/auth/set-offline-beacon', express.raw({ type: '*/*' }));

// Regular middleware setup
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// app.use(cookieParser());

// Log environment status
console.log('Environment configuration:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`- CLIENT_URL: ${process.env.CLIENT_URL || 'not set'}`);
console.log(`- PORT: ${process.env.PORT || '5000 (default)'}`);
console.log(`- Payment gateways: ${[
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
// Comment out routes that don't exist yet
// app.use('/api/bookings', bookingRoutes);
// app.use('/api/payments', paymentRoutes);
// app.use('/api/doctor-auth', docAuthRoutes);
app.use('/api/users', userRoutes);

// Make uploads directory accessible
app.use('/uploads', express.static('uploads'));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('Socket auth token:', socket.handshake.auth.token ? 'Present' : 'Missing');
  console.log('Socket connection origin:', socket.handshake.headers.origin);
  console.log('Socket request URL:', socket.handshake.url);

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });

  // Extract user info from auth token
  const token = socket.handshake.auth.token;
  let userId: string | null = null;
  let sessionId: string | null = null;

  // If token exists, extract user ID and update user status
  if (token) {
    try {
      // Extract user ID from JWT token
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      userId = decoded.id || decoded._id;
      sessionId = decoded.sessionId;

      if (userId) {
        console.log(`User ${userId} is now online (Session: ${sessionId || 'unknown'})`);

        // ALWAYS update the user's online status immediately to ensure immediate UI feedback
        mongoose.connection.collection('users').updateOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          {
            $set: {
              isOnline: true,
              lastActive: new Date(),
              uniqueSessionId: sessionId || socket.id // Use sessionId if available, fall back to socket.id
            }
          }
        ).then(result => {
          console.log(`✅ User ${userId} online status updated: ${result.modifiedCount > 0 ? 'updated' : 'already updated'}`);
          
          // Store user ID in socket data for later use
          socket.data.userId = userId;
          socket.data.sessionId = sessionId || socket.id;

          // IMPORTANT: Always broadcast the status change event to ensure UI updates
          io.emit('user_status_changed', {
            userId,
            isOnline: true,
            lastActive: new Date()
          });
          
          // Also broadcast simpler event format for better compatibility
          io.emit('user_connected', {
            userId
          });
        }).catch(err => {
          console.error(`❌ Failed to update online status for user ${userId}:`, err);
        });
      } else {
        console.log('Token decoded but no userId found:', decoded);
      }
    } catch (error) {
      console.error('Error handling socket connection:', error);
    }
  }

  // Handle requests for list of currently online users
  socket.on('get_online_users', async () => {
    console.log('Client requested online users list');
    
    try {
      // Get all connected sockets and their user IDs
      const onlineUsers: string[] = [];
      
      // Get all connected socket IDs
      const socketIds = await io.fetchSockets();
      
      // Extract user IDs from socket data
      for (const socket of socketIds) {
        if (socket.data.userId) {
          onlineUsers.push(socket.data.userId);
        }
      }
      
      console.log('Sending online users list:', onlineUsers);
      
      // Send the list of online users to the requesting client
      socket.emit('online_users', {
        users: onlineUsers
      });
    } catch (error) {
      console.error('Error getting online users list:', error);
    }
  });

  // Handle request to check a specific user's online status
  socket.on('check_user_status', async (data: { userId: string }) => {
    try {
      const { userId } = data;
      console.log(`Socket request to check status for user: ${userId}`);
      
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        console.log(`Invalid user ID in status check: ${userId}`);
        return;
      }
      
      // First check if user has an active socket connection
      const sockets = await io.fetchSockets();
      const isConnected = sockets.some(s => s.data.userId === userId);
      
      if (isConnected) {
        console.log(`User ${userId} has active socket connection - reporting as ONLINE`);
        socket.emit('user_status_response', {
          userId,
          isOnline: true
        });
        return;
      }
      
      // If no active socket, check database
      const user = await mongoose.connection.db.collection('users').findOne({
        _id: new mongoose.Types.ObjectId(userId)
      });
      
      if (!user) {
        console.log(`User ${userId} not found in database`);
        socket.emit('user_status_response', {
          userId,
          isOnline: false
        });
        return;
      }
      
      // MORE LENIENT: Increase threshold for determining if a user is still online
      const ONLINE_THRESHOLD_MS = 30000; // 30 seconds (increased from 15)
      
      // Check if lastActive is recent enough to consider user online
      const now = new Date();
      const lastActive = user.lastActive ? new Date(user.lastActive) : null;
      const timeSinceLastActive = lastActive ? now.getTime() - lastActive.getTime() : Infinity;
      
      // User is considered online if flag is true OR recently active
      const isOnline = user.isOnline === true || (lastActive && timeSinceLastActive < ONLINE_THRESHOLD_MS);
      
      console.log(`Database status for ${userId}: ${isOnline ? 'ONLINE' : 'OFFLINE'} (Last active: ${lastActive ? `${Math.floor(timeSinceLastActive / 1000)}s ago` : 'never'})`);
      
      socket.emit('user_status_response', {
        userId,
        isOnline,
        lastActive: user.lastActive || null
      });
    } catch (error) {
      console.error(`Error checking user status: ${error}`);
      // Send a fallback response to avoid client waiting indefinitely
      if (data.userId) {
        socket.emit('user_status_response', {
          userId: data.userId,
          isOnline: false
        });
      }
    }
  });

  // Track typing status for each chat and user
  const typingUsers = new Map<string, Set<string>>();

  // Handle keep-alive pings
  socket.on('ping', (data: { userId: string }) => {
    const pingUserId = data.userId || socket.data.userId;
    const pingSessionId = socket.data.sessionId;
    
    if (pingUserId) {
      // Update user's last active time
      mongoose.connection.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(pingUserId) },
        {
          $set: {
            isOnline: true,
            lastActive: new Date()
          }
        }
      );
    }
  });

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
  socket.on('disconnect', async () => {
    console.log('⚠️ Socket disconnected:', socket.id);

    // Get the user ID and session ID associated with this socket
    const disconnectedUserId = socket.data?.userId;
    const disconnectedSessionId = socket.data?.sessionId;
    
    if (!disconnectedUserId) {
      console.log('Socket disconnected but no user ID was associated with it');
      return;
    }
    
    console.log(`⚠️ User ${disconnectedUserId} socket disconnected - marking as OFFLINE`);
    
    try {
      // SIMPLIFIED: Just mark user as offline, no complicated session tracking
      const db = mongoose.connection.db;
      const usersCollection = db.collection('users');
      
      const updateResult = await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(disconnectedUserId) },
        { $set: { isOnline: false, lastActive: new Date() } }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`✅ User ${disconnectedUserId} marked as OFFLINE`);
        
        // Broadcast to all clients
        io.emit('user_status_changed', {
          userId: disconnectedUserId,
          isOnline: false,
          lastActive: new Date()
        });
        
        // Also broadcast simpler event format for better compatibility
        io.emit('user_disconnected', {
          userId: disconnectedUserId
        });
      }
    } catch (error) {
      console.error(`❌ Error in socket disconnect handler:`, error);
    }
  });
});

// Make io accessible to routes
app.set('io', io);

// Setup periodic job to ensure users who disconnected without a proper event are marked offline
// This guarantees users are marked offline within seconds of closing their browser
setInterval(async () => {
  if (mongoose.connection.readyState === 1) { // Only run if connected to MongoDB
    try {
      const User = mongoose.model('User');
      const oneSecondAgo = new Date(Date.now() - 1000); // 1 second ago - ultra aggressive for Google users
      const fiveSecondsAgo = new Date(Date.now() - 5000); // 5 seconds ago for regular users
      
      // HIGHEST PRIORITY: Check for Google users FIRST before any other operation
      // This ensures they're processed even if the server is under load
      try {
        // Find any Google users that need to be marked offline
        const googleUsers = await User.find({
          lastAuthMethod: 'google',
          lastActive: { $lt: oneSecondAgo },
          isOnline: true
        }, '_id email uniqueSessionId');
        
        // Log and update each Google user individually to ensure maximum reliability
        for (const user of googleUsers) {
          console.log(`CRITICAL: Google user ${user._id} (${user.email}) inactive for >1s, marking OFFLINE`);
          
          // Direct database access for maximum reliability
          const result = await mongoose.connection.db.collection('users').updateOne(
            { _id: user._id },
            { $set: { isOnline: false, lastActive: new Date() } }
          );
          
          if (result.modifiedCount > 0) {
            console.log(`SUCCESS: Google user ${user._id} marked offline`);
            
            // Broadcast status change to all clients
            io.emit('user_status_changed', {
              userId: user._id.toString(),
              isOnline: false,
              lastActive: new Date()
            });
          }
        }
      } catch (googleError) {
        console.error('Error in Google user cleanup:', googleError);
      }
      
      // Now handle regular users with standard approach
      try {
        const inactiveRegularUsers = await User.find({
          $or: [
            { lastAuthMethod: { $ne: 'google' } },
            { lastAuthMethod: { $exists: false } }
          ],
          lastActive: { $lt: fiveSecondsAgo },
          isOnline: true
        }, '_id email');
        
        if (inactiveRegularUsers.length > 0) {
          console.log(`Found ${inactiveRegularUsers.length} inactive regular users to mark offline`);
          
          // Update in bulk
          const regularUserIds = inactiveRegularUsers.map(user => user._id);
          const regularUsersResult = await User.updateMany(
            { 
              _id: { $in: regularUserIds }
            },
            { 
              $set: { isOnline: false }
            }
          );
          
          if (regularUsersResult.modifiedCount > 0) {
            console.log(`Cleanup job: Marked ${regularUsersResult.modifiedCount} inactive regular users as offline (inactive >5s)`);
            
            // Broadcast status changes
            for (const user of inactiveRegularUsers) {
              io.emit('user_status_changed', {
                userId: user._id.toString(),
                isOnline: false,
                lastActive: new Date()
              });
            }
          }
        }
      } catch (regularError) {
        console.error('Error in regular user cleanup:', regularError);
      }
    } catch (error) {
      console.error('Error in cleanup job:', error);
    }
  }
}, 500); // Run twice per second for ultra-fast response

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pawshu')
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Check that required models are registered
    try {
      const registeredModels = mongoose.modelNames();
      console.log('Registered MongoDB models:', registeredModels);
      
      // Verify that 'User' model is registered
      if (registeredModels.includes('User')) {
        console.log('✅ User model is properly registered');
        
        // Verify the User model schema
        const userModel = mongoose.model('User');
        const userSchema = userModel.schema;
        console.log('User model fields:', Object.keys(userSchema.paths));
        
        // Verify if isOnline field exists
        if (userSchema.paths.isOnline) {
          console.log('✅ isOnline field exists in User model schema');
        } else {
          console.error('❌ isOnline field is missing from User model schema');
        }
      } else {
        console.error('❌ User model is not registered');
      }
    } catch (error) {
      console.error('Error checking model registration:', error);
    }
    
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
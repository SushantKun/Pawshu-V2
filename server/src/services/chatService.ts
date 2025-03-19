import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import Chat, { IMessage } from '../models/Chat';
import mongoose from 'mongoose';

// Socket.io connection management
interface SocketUser {
  userId: string;
  socketId: string;
}

// Map to keep track of online users
const connectedUsers = new Map<string, string[]>(); // userId -> [socketIds]

export const setupSocketIO = (httpServer: HttpServer) => {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: 'http://localhost:5173', // Frontend URL
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as { _id: string };
      socket.data.userId = decoded._id;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    
    console.log(`User connected: ${userId} (Socket ID: ${socket.id})`);
    
    // Add user to connected users map
    if (connectedUsers.has(userId)) {
      connectedUsers.get(userId)?.push(socket.id);
    } else {
      connectedUsers.set(userId, [socket.id]);
    }

    // Send online status to all connected clients
    io.emit('userStatus', {
      userId,
      status: 'online'
    });

    // Join user to their chat rooms
    Chat.find({ participants: userId })
      .then(chats => {
        chats.forEach(chat => {
          socket.join(chat._id.toString());
        });
      })
      .catch(err => console.error('Error joining chat rooms:', err));

    // Handle sending messages
    socket.on('sendMessage', async (data) => {
      try {
        const { chatId, content } = data;
        
        if (!chatId || !content) {
          socket.emit('error', { message: 'Chat ID and content are required' });
          return;
        }

        const chat = await Chat.findById(chatId);
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Check if user is a participant
        if (!chat.participants.includes(new mongoose.Types.ObjectId(userId))) {
          socket.emit('error', { message: 'Not authorized to send messages in this chat' });
          return;
        }

        // Add message to chat
        const message = {
          sender: new mongoose.Types.ObjectId(userId),
          content,
          timestamp: new Date(),
          read: false
        };

        chat.messages.push(message);
        chat.lastMessage = {
          content,
          timestamp: new Date(),
          sender: new mongoose.Types.ObjectId(userId)
        };

        await chat.save();

        // Broadcast message to all users in the chat
        io.to(chatId).emit('newMessage', {
          chatId,
          message: {
            ...message,
            _id: chat.messages[chat.messages.length - 1]._id
          }
        });

        // Update conversation list for participants
        chat.participants.forEach(participantId => {
          const participantSocketIds = connectedUsers.get(participantId.toString());
          if (participantSocketIds && participantSocketIds.length > 0) {
            participantSocketIds.forEach(socketId => {
              io.to(socketId).emit('updateConversation', {
                chatId,
                lastMessage: {
                  content,
                  timestamp: new Date(),
                  sender: userId
                }
              });
            });
          }
        });
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Handle read receipts
    socket.on('markAsRead', async (data) => {
      try {
        const { chatId } = data;
        
        if (!chatId) {
          socket.emit('error', { message: 'Chat ID is required' });
          return;
        }

        const chat = await Chat.findById(chatId);
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Check if user is a participant
        if (!chat.participants.includes(new mongoose.Types.ObjectId(userId))) {
          socket.emit('error', { message: 'Not authorized to access this chat' });
          return;
        }

        // Mark unread messages as read
        await Chat.updateOne(
          { _id: chatId },
          { $set: { 'messages.$[elem].read': true } },
          { arrayFilters: [{ 'elem.read': false, 'elem.sender': { $ne: new mongoose.Types.ObjectId(userId) } }] }
        );

        // Notify other participants
        chat.participants.forEach(participantId => {
          if (participantId.toString() !== userId) {
            const participantSocketIds = connectedUsers.get(participantId.toString());
            if (participantSocketIds && participantSocketIds.length > 0) {
              participantSocketIds.forEach(socketId => {
                io.to(socketId).emit('messagesRead', {
                  chatId,
                  userId
                });
              });
            }
          }
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Error marking messages as read' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { chatId } = data;
      
      if (!chatId) {
        return;
      }

      // Broadcast to all users in the chat except the sender
      socket.to(chatId).emit('userTyping', {
        chatId,
        userId
      });
    });

    // Handle stop typing indicator
    socket.on('stopTyping', (data) => {
      const { chatId } = data;
      
      if (!chatId) {
        return;
      }

      // Broadcast to all users in the chat except the sender
      socket.to(chatId).emit('userStoppedTyping', {
        chatId,
        userId
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      
      // Remove socket from connected users map
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        const index = userSockets.indexOf(socket.id);
        if (index !== -1) {
          userSockets.splice(index, 1);
        }
        
        if (userSockets.length === 0) {
          connectedUsers.delete(userId);
          
          // Send offline status to all connected clients
          io.emit('userStatus', {
            userId,
            status: 'offline'
          });
        }
      }
    });
  });

  return io;
};

// Function to get a user's online status
export const getUserStatus = (userId: string) => {
  return connectedUsers.has(userId) ? 'online' : 'offline';
};

// Function to emit an event to a specific user
export const emitToUser = (userId: string, event: string, data: any, io: SocketServer) => {
  const userSockets = connectedUsers.get(userId);
  if (userSockets && userSockets.length > 0) {
    userSockets.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
    return true;
  }
  return false;
}; 
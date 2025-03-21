import { Server as SocketServer, Socket as SocketIOSocket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import mongoose, { Document } from 'mongoose';
import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import Chat, { IChat as IChatDocument, IMessage } from '../models/Chat';
import crypto from 'crypto';

// Extend Socket interface to include custom properties
declare module 'socket.io' {
  interface Socket {
    userId?: string;
  }
}

// Map to track connected users and their socket IDs
const connectedUsers = new Map<string, string[]>();

class ChatService {
  static async getUserChats(userId: string): Promise<IChatDocument[]> {
    try {
      const chats = await Chat.find({
        participants: new mongoose.Types.ObjectId(userId)
      })
      .populate({
        path: 'participants',
        select: '_id name email'
      })
      .populate({
        path: 'messages.sender',
        select: '_id name email'
      })
      .sort({ 'messages.timestamp': -1 })
      .exec();

      return chats;
    } catch (error) {
      console.error('Error fetching user chats:', error);
      return [];
    }
  }

  static async getChatById(chatId: string, userId: string): Promise<IChatDocument | null> {
    try {
      const chat = await Chat.findOne({
        _id: new mongoose.Types.ObjectId(chatId),
        participants: new mongoose.Types.ObjectId(userId)
      })
      .populate({
        path: 'participants',
        select: '_id name email'
      })
      .populate({
        path: 'messages.sender',
        select: '_id name email'
      })
      .sort({ 'messages.timestamp': 1 })
      .exec();

      return chat;
    } catch (error) {
      console.error('Error fetching chat:', error);
      return null;
    }
  }

  static async addMessageToChat(
    chatId: string, 
    senderId: string, 
    content: string,
    attachmentData?: {
      url: string;
      type: string;
      name: string;
      thumbnailUrl?: string;
    }
  ): Promise<{ success: boolean; data?: IMessage & { _id: mongoose.Types.ObjectId }; error?: string }> {
    try {
      const chat = await Chat.findById(chatId);

      if (!chat) {
        return { 
          success: false, 
          error: 'Chat not found' 
        };
      }

      // Verify sender is a participant
      const isSenderParticipant = chat.participants.some(
        (p: mongoose.Types.ObjectId) => p.toString() === senderId
      );

      if (!isSenderParticipant) {
        return { 
          success: false, 
          error: 'Sender is not a participant of this chat' 
        };
      }

      const newMessageId = new mongoose.Types.ObjectId();
      const newMessage: IMessage = {
        _id: newMessageId,
        sender: new mongoose.Types.ObjectId(senderId),
        content: content.trim(),
        timestamp: new Date(),
        read: false,
        status: 'sent' as 'sent' | 'delivered' | 'read'
      };

      if (attachmentData) {
        newMessage.attachment = {
          url: attachmentData.url,
          type: attachmentData.type,
          name: attachmentData.name,
          thumbnailUrl: attachmentData.thumbnailUrl
        };
      }

      chat.messages.push(newMessage);
      await chat.save();

      // Populate sender details
      const populatedMessage = await Chat.populate(newMessage, {
        path: 'sender',
        select: '_id name email'
      });

      // Create a plain object with only the required IMessage properties
      const messageData: IMessage & { _id: mongoose.Types.ObjectId } = {
        _id: newMessageId,
        sender: newMessage.sender,
        content: newMessage.content,
        timestamp: newMessage.timestamp,
        read: newMessage.read,
        status: newMessage.status
      };

      if (attachmentData) {
        messageData.attachment = newMessage.attachment;
      }

      return { 
        success: true, 
        data: messageData
      };
    } catch (error) {
      console.error('Error adding message to chat:', error);
      return { 
        success: false, 
        error: 'Failed to add message' 
      };
    }
  }

  static async markMessagesAsRead(
    chatId: string, 
    userId: string
  ): Promise<boolean> {
    try {
      const chat = await Chat.findById(chatId);

      if (!chat) {
        return false;
      }

      // Mark messages from other participants as read and update status
      const updatedChat = await Chat.updateOne(
        { 
          _id: chatId, 
          'messages.sender': { $ne: new mongoose.Types.ObjectId(userId) },
          'messages.read': false 
        },
        { 
          $set: { 
            'messages.$[].read': true,
            'messages.$[].status': 'read'
          } 
        }
      );

      return updatedChat.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
  }
}

const setupSocketIO = (server: HttpServer): SocketServer => {
  const io = new SocketServer(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket: SocketIOSocket, next) => {
    const token = socket.handshake.auth.token;
    
    try {
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as { _id: string };
      
      const user = await User.findById(decoded._id);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user ID to socket for later use
      socket.userId = user._id.toString();
      next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: SocketIOSocket) => {
    const userId = socket.userId as string;

    // Track connected users
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, []);
    }
    connectedUsers.get(userId)?.push(socket.id);

    console.log(`User connected: ${userId} (Socket ID: ${socket.id})`);

    // Join user to their chat rooms
    ChatService.getUserChats(userId)
      .then((chats: IChatDocument[]) => {
        chats.forEach((chat: IChatDocument) => {
          socket.join(chat._id.toString());
        });
      })
      .catch((err: Error) => {
        console.error('Error joining chat rooms:', err);
      });

    // Send message
    socket.on('sendMessage', async (
      { chatId, content, uniqueMessageKey, attachmentData }: { 
        chatId: string; 
        content: string; 
        uniqueMessageKey?: string;
        attachmentData?: {
          url: string;
          type: string;
          name: string;
          thumbnailUrl?: string;
        }
      }, 
      callback?: (response: { success: boolean; messageId?: string; error?: string }) => void
    ) => {
      // Validate inputs
      if (!chatId || (!content || content.trim() === '') && !attachmentData) {
        if (callback) {
          return callback({ 
            success: false, 
            error: 'Invalid message or chat ID' 
          });
        }
        return;
      }

      try {
        const result = await ChatService.addMessageToChat(chatId, userId, content, attachmentData);
        
        if (!result.success) {
          if (callback) {
            return callback({ 
              success: false, 
              error: result.error || 'Failed to add message to chat' 
            });
          }
          return;
        }

        // Ensure data is not undefined
        const messageData = result.data!;

        // Emit to room EXCEPT the sender
        socket.to(chatId).emit('newMessage', { 
          chatId, 
          message: {
            ...messageData,
            uniqueMessageKey,
            isSenderMessage: false,
            originalSenderId: userId
          }
        });

        // Send acknowledgment to the sender
        socket.emit('messageSent', {
          chatId,
          message: {
            ...messageData,
            uniqueMessageKey,
            isSenderMessage: true,
            originalSenderId: userId
          }
        });

        // Send acknowledgment with message details
        if (callback) {
          callback({ 
            success: true,
            messageId: messageData._id.toString()
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
        
        if (callback) {
          callback({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to send message' 
          });
        }
      }
    });

    // Handle reading messages
    socket.on('readMessages', async ({ chatId }) => {
      try {
        const success = await ChatService.markMessagesAsRead(chatId, userId);
        if (!success) {
          return socket.emit('error', { message: 'Failed to mark messages as read' });
        }

        // Find the other participant to notify them
        const chat = await ChatService.getChatById(chatId, userId);
        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
        }

        const otherParticipantId = chat.participants.find(
          (p: mongoose.Types.ObjectId) => p.toString() !== userId
        );
        
        if (otherParticipantId) {
          // Emit a 'messagesRead' event to the other user (matches client event name)
          const connectedSocketIds = connectedUsers.get(otherParticipantId.toString()) || [];
          
          for (const socketId of connectedSocketIds) {
            io.to(socketId).emit('messagesRead', {
              chatId,
              readBy: userId,
              timestamp: new Date()
            });
          }
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Internal server error' });
      }
    });

    // Typing indicators
    socket.on('typing', ({ chatId }) => {
      if (!chatId) return;

      try {
        const chat = ChatService.getChatById(chatId, userId);
        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
        }

        // Get the typing user's information for identification
        socket.to(chatId).emit('userTyping', { 
          chatId, 
          userId, 
          userName: 'User' // You might want to fetch actual name 
        });
      } catch (error) {
        console.error('Error handling typing event:', error);
      }
    });

    socket.on('stopTyping', ({ chatId }) => {
      if (!chatId) return;

      socket.to(chatId).emit('userStoppedTyping', { 
        chatId, 
        userId 
      });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      // Remove this specific socket ID from connected users
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        const index = userSockets.indexOf(socket.id);
        if (index > -1) {
          userSockets.splice(index, 1);
        }

        // If no more sockets for this user, remove the entry
        if (userSockets.length === 0) {
          connectedUsers.delete(userId);
        }
      }

      console.log(`User disconnected: ${userId}`);
    });
  });

  return io;
};

export default setupSocketIO;
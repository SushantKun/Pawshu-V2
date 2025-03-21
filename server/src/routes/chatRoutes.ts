import express, { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../middleware/auth';
import Chat, { IMessage, IChat } from '../models/Chat';
import User from '../models/User';
import mongoose, { Document } from 'mongoose';
import { AuthRequest } from '../types/auth';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = express.Router();

// Upload file endpoint
router.post('/upload', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.body.file || !req.body.file.startsWith('data:')) {
      return res.status(400).json({ message: 'No valid file data provided' });
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const fileType = req.body.file.split(';')[0].split(':')[1];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    // Upload file to Cloudinary
    const result: UploadApiResponse = await cloudinary.uploader.upload(req.body.file, {
      folder: 'chat_attachments',
      resource_type: 'auto'
    });

    res.json({
      url: result.secure_url,
      type: fileType,
      name: req.body.fileName || 'Uploaded file'
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    next(error);
  }
});

// Get list of conversations for the current user
router.get('/', verifyToken, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const userId = authReq.user._id;
  console.log(`Fetching chats for user: ${userId}`);

  Chat.find({ participants: userId })
    .populate('participants', 'name email')
    .populate({
      path: 'lastMessage.sender',
      select: 'name email'
    })
    .sort({ 'lastMessage.timestamp': -1 })
    .then(chats => {
      console.log(`Found ${chats.length} chats for user ${userId}`);
      res.json(chats);
    })
    .catch(next);
});

// Initiate a new conversation
router.post('/initiate', verifyToken, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const { recipientId, contextType, referenceId, initialMessage, attachment } = req.body;
  console.log('Initiating chat with data:', { recipientId, contextType, referenceId, initialMessage, attachment });

  if (!recipientId || !contextType || !referenceId || !initialMessage) {
    console.log('Missing fields in request:', req.body);
    return res.status(400).json({ message: 'Missing required fields' });
  }

  let existingChat: Document<unknown, {}, IChat> & IChat & { _id: mongoose.Types.ObjectId } | null = null;

  // Validate recipient exists
  User.findById(recipientId)
    .then(recipient => {
      if (!recipient) {
        console.log(`Recipient not found with ID: ${recipientId}`);
        return Promise.reject({ status: 404, message: 'Recipient not found' });
      }

      // Don't allow initiating a chat with yourself
      if (authReq.user!._id.toString() === recipientId) {
        console.log('User attempting to chat with themselves');
        return Promise.reject({ status: 400, message: 'Cannot initiate chat with yourself' });
      }

      console.log('Checking for existing chat between users for context:', contextType, referenceId);
      
      // Check if a conversation already exists for this context
      return Chat.findOne({
        participants: { $all: [authReq.user!._id, recipientId] },
        'context.type': contextType,
        'context.referenceId': referenceId
      });
    })
    .then(chat => {
      if (chat) {
        existingChat = chat;
        console.log('Found existing chat:', existingChat._id);
        // Add new message to existing chat
        existingChat.messages.push({
          sender: authReq.user!._id,
          content: initialMessage,
          timestamp: new Date(),
          read: false,
          status: 'sent' as const,
          attachment
        });

        existingChat.lastMessage = {
          content: initialMessage,
          timestamp: new Date(),
          sender: authReq.user!._id,
          status: 'sent' as const
        };

        return existingChat.save();
      }

      console.log('Creating new chat between users');
      
      // Create new chat
      const newChat = new Chat({
        participants: [authReq.user!._id, recipientId],
        context: {
          type: contextType,
          referenceId: new mongoose.Types.ObjectId(referenceId)
        },
        messages: [{
          sender: authReq.user!._id,
          content: initialMessage,
          timestamp: new Date(),
          read: false,
          status: 'sent' as const,
          attachment
        }],
        lastMessage: {
          content: initialMessage,
          timestamp: new Date(),
          sender: authReq.user!._id,
          status: 'sent' as const
        }
      });

      return newChat.save();
    })
    .then(chat => {
      return Chat.findById(chat._id)
        .populate('participants', 'name email')
        .populate({
          path: 'lastMessage.sender',
          select: 'name email'
        });
    })
    .then(chat => {
      if (!chat) {
        return Promise.reject({ status: 500, message: 'Failed to create chat' });
      }
      res.status(201).json(chat);
    })
    .catch(error => {
      if (error.status) {
        res.status(error.status).json({ message: error.message });
      } else {
        next(error);
      }
    });
});

// Get messages for a specific chat
router.get('/:chatId', verifyToken, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  
  const userId = authReq.user._id;
  console.log(`Fetching chat with ID: ${req.params.chatId} for user: ${userId}`);
  
  if (!mongoose.Types.ObjectId.isValid(req.params.chatId)) {
    console.log(`Invalid chat ID format: ${req.params.chatId}`);
    return res.status(400).json({ message: 'Invalid chat ID format' });
  }
  
  Chat.findById(req.params.chatId)
    .then(chat => {
      if (!chat) {
        console.log(`Chat not found with ID: ${req.params.chatId}`);
        return Promise.reject({ status: 404, message: 'Chat not found' });
      }

      // Check if user is a participant
      if (!chat.participants.some(p => p.toString() === userId.toString())) {
        console.log(`User ${userId} is not a participant in chat ${req.params.chatId}`);
        return Promise.reject({ status: 403, message: 'Not authorized to view this chat' });
      }

      console.log(`Marking messages as read in chat: ${req.params.chatId}`);
      
      // Mark unread messages as read and update their status
      return Chat.findOneAndUpdate(
        { 
          _id: req.params.chatId,
          'messages.read': false,
          'messages.sender': { $ne: userId }
        },
        { 
          $set: { 
            'messages.$[elem].read': true,
            'messages.$[elem].status': 'read'
          }
        },
        { 
          arrayFilters: [{ 'elem.read': false, 'elem.sender': { $ne: userId } }],
          new: true
        }
      ).populate('participants', 'name email')
        .populate('messages.sender', 'name email');
    })
    .then(updatedChat => {
      if (!updatedChat) {
        console.log(`No unread messages to mark as read in chat: ${req.params.chatId}`);
        // If no messages needed to be marked as read, we still need to return the chat with populated fields
        return Chat.findById(req.params.chatId)
          .populate('participants', 'name email')
          .populate('messages.sender', 'name email');
      }
      return updatedChat;
    })
    .then(chat => {
      if (!chat) {
        return Promise.reject({ status: 404, message: 'Chat not found' });
      }
      console.log(`Successfully fetched and updated chat: ${req.params.chatId}`);
      res.json(chat);
    })
    .catch(error => {
      if (error.status) {
        res.status(error.status).json({ message: error.message });
      } else {
        next(error);
      }
    });
});

// Send a message in an existing chat
router.post('/:chatId/messages', verifyToken, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const userId = authReq.user._id;
  const { content, attachment } = req.body;
  
  console.log(`Sending message to chat ${req.params.chatId} from user ${userId}:`, content?.substring(0, 50));
  
  if (!content && !attachment) {
    return res.status(400).json({ message: 'Message content or attachment is required' });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.chatId)) {
    console.log(`Invalid chat ID format: ${req.params.chatId}`);
    return res.status(400).json({ message: 'Invalid chat ID format' });
  }

  Chat.findById(req.params.chatId)
    .then(chat => {
      if (!chat) {
        console.log(`Chat not found with ID: ${req.params.chatId}`);
        return Promise.reject({ status: 404, message: 'Chat not found' });
      }

      // Check if user is a participant
      if (!chat.participants.some(p => p.toString() === userId.toString())) {
        console.log(`User ${userId} is not a participant in chat ${req.params.chatId}`);
        return Promise.reject({ status: 403, message: 'Not authorized to send messages in this chat' });
      }

      // Add message to chat
      const message: IMessage = {
        sender: userId,
        content: content || '',
        timestamp: new Date(),
        read: false,
        status: 'sent' as const,
        attachment
      };

      chat.messages.push(message);
      chat.lastMessage = {
        content: content || 'Attachment',
        timestamp: new Date(),
        sender: userId,
        status: 'sent' as const
      };

      return chat.save();
    })
    .then(chat => {
      // Return the new message with populated sender
      return Chat.findById(chat._id)
        .populate('participants', 'name email')
        .populate('messages.sender', 'name email');
    })
    .then(updatedChat => {
      if (!updatedChat) {
        return Promise.reject({ status: 500, message: 'Failed to update chat' });
      }
      console.log(`Successfully sent message to chat ${req.params.chatId}`);
      res.status(201).json(updatedChat);
    })
    .catch(error => {
      if (error.status) {
        res.status(error.status).json({ message: error.message });
      } else {
        next(error);
      }
    });
});

// Update message status
router.patch('/:chatId/messages/:messageId/status', verifyToken, (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const { status } = req.body;
  if (!['sent', 'delivered', 'read'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  Chat.findById(req.params.chatId)
    .then(chat => {
      if (!chat) {
        return Promise.reject({ status: 404, message: 'Chat not found' });
      }

      const message = chat.messages.find(m => m._id?.toString() === req.params.messageId);
      if (!message) {
        return Promise.reject({ status: 404, message: 'Message not found' });
      }

      message.status = status as 'sent' | 'delivered' | 'read';
      if (status === 'read') {
        message.read = true;
      }

      // Update last message status if this is the last message
      const lastMessage = chat.messages[chat.messages.length - 1];
      if (lastMessage && lastMessage._id?.toString() === req.params.messageId) {
        chat.lastMessage.status = status as 'sent' | 'delivered' | 'read';
      }

      return chat.save();
    })
    .then(chat => {
      res.json(chat);
    })
    .catch(error => {
      if (error.status) {
        res.status(error.status).json({ message: error.message });
      } else {
        next(error);
      }
    });
});

export default router; 
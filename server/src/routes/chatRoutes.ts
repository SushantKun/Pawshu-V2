import express, { Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import Chat from '../models/Chat';
import User from '../models/User';
import mongoose from 'mongoose';
import { AuthRequest } from '../types/auth';

const router = express.Router();

// Get list of conversations for the current user
router.get('/', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const userId = req.user._id;
    console.log(`Fetching chats for user: ${userId}`);

    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'name email')
      .populate({
        path: 'lastMessage.sender',
        select: 'name email'
      })
      .sort({ 'lastMessage.timestamp': -1 });

    console.log(`Found ${chats.length} chats for user ${userId}`);
    res.json(chats);
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Initiate a new conversation
router.post('/initiate', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { recipientId, contextType, referenceId, initialMessage } = req.body;
    console.log('Initiating chat with data:', { recipientId, contextType, referenceId, initialMessage });

    if (!recipientId || !contextType || !referenceId || !initialMessage) {
      console.log('Missing fields in request:', req.body);
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      console.log(`Recipient not found with ID: ${recipientId}`);
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Don't allow initiating a chat with yourself
    if (req.user._id.toString() === recipientId) {
      console.log('User attempting to chat with themselves');
      return res.status(400).json({ message: 'Cannot initiate chat with yourself' });
    }

    console.log('Checking for existing chat between users for context:', contextType, referenceId);
    
    // Check if a conversation already exists for this context
    const existingChat = await Chat.findOne({
      participants: { $all: [req.user._id, recipientId] },
      'context.type': contextType,
      'context.referenceId': referenceId
    });

    if (existingChat) {
      console.log('Found existing chat:', existingChat._id);
      // Add new message to existing chat
      existingChat.messages.push({
        sender: req.user._id,
        content: initialMessage,
        timestamp: new Date(),
        read: false
      });

      existingChat.lastMessage = {
        content: initialMessage,
        timestamp: new Date(),
        sender: req.user._id
      };

      await existingChat.save();
      
      const populatedExistingChat = await Chat.findById(existingChat._id)
        .populate('participants', 'name email')
        .populate({
          path: 'lastMessage.sender',
          select: 'name email'
        });
        
      return res.json(populatedExistingChat);
    }

    console.log('Creating new chat between users');
    
    // Create new chat
    const newChat = new Chat({
      participants: [req.user._id, recipientId],
      context: {
        type: contextType,
        referenceId: new mongoose.Types.ObjectId(referenceId)
      },
      messages: [{
        sender: req.user._id,
        content: initialMessage,
        timestamp: new Date(),
        read: false
      }],
      lastMessage: {
        content: initialMessage,
        timestamp: new Date(),
        sender: req.user._id
      }
    });

    await newChat.save();
    console.log('New chat created with ID:', newChat._id);

    // Populate the response
    const populatedChat = await Chat.findById(newChat._id)
      .populate('participants', 'name email')
      .populate({
        path: 'lastMessage.sender',
        select: 'name email'
      });

    res.status(201).json(populatedChat);
  } catch (error: any) {
    console.error('Error initiating chat:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get messages for a specific chat
router.get('/:chatId', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const userId = req.user._id; // Store user ID to avoid TypeScript nullable warnings
    console.log(`Fetching chat with ID: ${req.params.chatId} for user: ${userId}`);
    
    if (!mongoose.Types.ObjectId.isValid(req.params.chatId)) {
      console.log(`Invalid chat ID format: ${req.params.chatId}`);
      return res.status(400).json({ message: 'Invalid chat ID format' });
    }
    
    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) {
      console.log(`Chat not found with ID: ${req.params.chatId}`);
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is a participant
    if (!chat.participants.some(p => p.toString() === userId.toString())) {
      console.log(`User ${userId} is not a participant in chat ${req.params.chatId}`);
      return res.status(403).json({ message: 'Not authorized to view this chat' });
    }

    console.log(`Marking messages as read in chat: ${req.params.chatId}`);
    
    // Mark unread messages as read
    const updatedChat = await Chat.findOneAndUpdate(
      { 
        _id: req.params.chatId,
        'messages.read': false,
        'messages.sender': { $ne: userId }
      },
      { $set: { 'messages.$[elem].read': true } },
      { 
        arrayFilters: [{ 'elem.read': false, 'elem.sender': { $ne: userId } }],
        new: true
      }
    ).populate('participants', 'name email')
      .populate('messages.sender', 'name email');
      
    if (!updatedChat) {
      console.log(`No unread messages to mark as read in chat: ${req.params.chatId}`);
      // If no messages needed to be marked as read, we still need to return the chat with populated fields
      const populatedChat = await Chat.findById(req.params.chatId)
        .populate('participants', 'name email')
        .populate('messages.sender', 'name email');
        
      return res.json(populatedChat);
    }
    
    console.log(`Successfully fetched and updated chat: ${req.params.chatId}`);
    res.json(updatedChat);
  } catch (error: any) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send a message in an existing chat
router.post('/:chatId/messages', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const userId = req.user._id; // Store user ID to avoid TypeScript nullable warnings
    const { content } = req.body;
    
    console.log(`Sending message to chat ${req.params.chatId} from user ${userId}:`, content.substring(0, 50));
    
    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.chatId)) {
      console.log(`Invalid chat ID format: ${req.params.chatId}`);
      return res.status(400).json({ message: 'Invalid chat ID format' });
    }

    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) {
      console.log(`Chat not found with ID: ${req.params.chatId}`);
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is a participant
    if (!chat.participants.some(p => p.toString() === userId.toString())) {
      console.log(`User ${userId} is not a participant in chat ${req.params.chatId}`);
      return res.status(403).json({ message: 'Not authorized to send messages in this chat' });
    }

    // Add message to chat
    const message = {
      sender: userId,
      content,
      timestamp: new Date(),
      read: false
    };

    chat.messages.push(message);
    chat.lastMessage = {
      content,
      timestamp: new Date(),
      sender: userId
    };

    await chat.save();
    console.log(`Message saved to chat ${req.params.chatId}`);

    // Return the new message with populated sender
    const updatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name email')
      .populate('messages.sender', 'name email');
      
    console.log(`Successfully sent message to chat ${req.params.chatId}`);
    res.status(201).json(updatedChat);
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router; 
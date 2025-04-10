import express from 'express';
import { Chat, Message } from '../models/Chat';
import { verifyToken } from '../middleware/auth';
import { AuthRequest } from '../types/auth';

const router = express.Router();

// Get all chats for a user
router.get('/', verifyToken, async (req: AuthRequest, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user?._id
    })
    .populate('participants', 'firstName lastName email')
    .sort({ lastMessage: -1 });
    
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching chats' });
  }
});

// Get messages for a specific chat
router.get('/:chatId/messages', verifyToken, async (req: AuthRequest, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
      .populate({
        path: 'messages.sender',
        select: 'firstName lastName email'
      });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Check if user is a participant
    if (req.user && !chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }
    
    res.json(chat.messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Create a new chat or get existing chat
router.post('/', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { participantId } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // Check if chat already exists
    let chat = await Chat.findOne({
      participants: {
        $all: [req.user._id, participantId]
      }
    });
    
    if (chat) {
      return res.json(chat);
    }
    
    // Create new chat
    chat = new Chat({
      participants: [req.user._id, participantId],
      messages: []
    });
    
    await chat.save();
    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ message: 'Error creating chat' });
  }
});

// Send a message
router.post('/:chatId/message', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Check if user is a participant
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to send messages in this chat' });
    }
    
    const message = {
      sender: req.user._id,
      content,
      timestamp: new Date(),
      status: 'sent'
    };
    
    chat.messages.push(message);
    chat.lastMessage = new Date();
    await chat.save();
    
    // Emit the message through socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('receive_message', message);
    }
    
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error sending message' });
  }
});

export default router; 
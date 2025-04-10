/**
 * Chat Controller
 * 
 * Handles all chat-related business logic including fetching chats,
 * retrieving messages, creating new chats, and sending messages.
 */

import { Request, Response } from 'express';
import { Chat } from '../models/Chat';
import { AuthRequest } from '../types/auth';

/**
 * Get all chats for the authenticated user
 * 
 * @param req - The request object containing user authentication details
 * @param res - The response object for sending back chat data or error messages
 */
export const getUserChats = async (req: AuthRequest, res: Response) => {
  try {
    // Find all chats where the current user is a participant
    const chats = await Chat.find({
      participants: req.user?._id
    })
    .populate('participants', 'firstName lastName email')
    .sort({ lastMessage: -1 });
    
    res.json(chats);
  } catch (error) {
    console.error('Error fetching user chats:', error);
    res.status(500).json({ message: 'Error fetching chats' });
  }
};

/**
 * Get all messages for a specific chat
 * 
 * @param req - The request object containing chat ID and user authentication details
 * @param res - The response object for sending back messages or error responses
 */
export const getChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Verify that the requesting user is a participant in the chat
    if (req.user && !chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }
    
    // Return messages with consistent sender format (just the ID string)
    // This ensures consistency with socket.io messages
    const messages = chat.messages.map(msg => ({
      _id: msg._id,
      sender: msg.sender,
      content: msg.content,
      timestamp: msg.timestamp,
      status: msg.status
    }));
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
};

/**
 * Create a new chat or return an existing one between two users
 * 
 * @param req - The request object containing participant ID and user authentication details
 * @param res - The response object for sending back the chat data or error messages
 */
export const createChat = async (req: AuthRequest, res: Response) => {
  try {
    const { participantId } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // Check if a chat already exists between these two users
    let chat = await Chat.findOne({
      participants: {
        $all: [req.user._id, participantId]
      }
    });
    
    if (chat) {
      return res.json(chat);
    }
    
    // If no existing chat, create a new one
    chat = new Chat({
      participants: [req.user._id, participantId],
      messages: []
    });
    
    await chat.save();
    res.status(201).json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ message: 'Error creating chat' });
  }
};

/**
 * Send a message in a specific chat
 * 
 * @param req - The request object containing message content, chat ID and user authentication
 * @param res - The response object for sending back the message data or error responses
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Verify that the requesting user is a participant in the chat
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to send messages in this chat' });
    }
    
    // Create a new message object
    const message = {
      sender: req.user._id,
      content,
      timestamp: new Date(),
      status: 'sent'
    };
    
    // Add the message to the chat and update the last message timestamp
    chat.messages.push(message);
    chat.lastMessage = new Date();
    await chat.save();
    
    // Emit the message through socket.io for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('receive_message', message);
    }
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
}; 
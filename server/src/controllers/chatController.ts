/**
 * Chat Controller
 * 
 * Handles all chat-related business logic including fetching chats,
 * retrieving messages, creating new chats, and sending messages.
 */

import { Request, Response } from 'express';
import { Chat } from '../models/Chat';
import { AuthRequest } from '../types/auth';
import mongoose from 'mongoose';

/**
 * Get all chats for the authenticated user
 * 
 * @param req - The request object containing user authentication details
 * @param res - The response object for sending back the chat data or error messages
 */
export const getUserChats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const chats = await Chat.find({
      participants: req.user._id
    })
    .populate({
      path: 'participants',
      select: 'username imageUrl email firstName lastName role',
      match: { _id: { $ne: req.user._id } }
    })
    .populate({
      path: 'reportId',
      select: 'status title'
    })
    .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
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
 * @param req - The request object containing participant ID, reportId and user authentication details
 * @param res - The response object for sending back the chat data or error messages
 */
export const createChat = async (req: AuthRequest, res: Response) => {
  try {
    const { participantId, reportId } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // If creating a chat for a report, check if the report is resolved
    if (reportId) {
      const mongoose = require('mongoose');
      const LostFound = mongoose.model('LostFound');
      const report = await LostFound.findById(reportId);
      
      if (report && report.status === 'resolved') {
        return res.status(403).json({ 
          message: 'This report has been resolved. Messaging has been disabled.' 
        });
      }
    }
    
    // Check if a chat already exists between these two users
    let chat = await Chat.findOne({
      participants: {
        $all: [req.user._id, participantId]
      },
      reportId: reportId || null
    });
    
    if (chat) {
      // If the existing chat is for a resolved report, check its active status
      if (chat.isActive === false) {
        return res.status(403).json({ 
          message: 'This chat is inactive due to a resolved report. Messaging has been disabled.' 
        });
      }
      
      return res.json(chat);
    }
    
    // If no existing chat, create a new one
    chat = new Chat({
      participants: [req.user._id, participantId],
      messages: [],
      reportId: reportId || null
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
    
    const chat = await Chat.findById(req.params.chatId)
      .populate({
        path: 'participants',
        select: 'firstName lastName email'
      });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Verify that the requesting user is a participant in the chat
    if (!chat.participants.some(p => p._id.toString() === req.user?._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to send messages in this chat' });
    }
    
    // If the chat is for a report, double-check the report status directly
    if (chat.reportId) {
      const mongoose = require('mongoose');
      const LostFound = mongoose.model('LostFound');
      
      try {
        const report = await LostFound.findById(chat.reportId);
        if (report && report.status === 'resolved') {
          return res.status(403).json({ 
            message: 'This chat is for a resolved report. Messages cannot be sent.' 
          });
        }
      } catch (error) {
        console.error('Error checking report status:', error);
        // Continue if we can't check the report (fallback to using chat.isActive)
      }
    }
    
    // Check if the chat is active - strictly prevent sending messages in inactive chats
    if (chat.isActive === false) {
      console.log('Attempt to send message in inactive chat rejected');
      return res.status(403).json({ 
        message: 'This chat is inactive due to a resolved report. Messages cannot be sent.' 
      });
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

/**
 * Update chat active status
 * 
 * @param req - The request object containing chat ID, isActive status, and user authentication
 * @param res - The response object for sending back updated chat or error responses
 */
export const updateChatStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { isActive } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Verify that the requesting user is a participant in the chat
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to update this chat' });
    }
    
    // Update isActive status
    chat.isActive = isActive;
    await chat.save();
    
    res.json({ message: 'Chat status updated successfully', chat });
  } catch (error) {
    console.error('Error updating chat status:', error);
    res.status(500).json({ message: 'Error updating chat status' });
  }
};

/**
 * Update message status
 * 
 * @param req - The request object containing chat ID, message ID, status, and user authentication
 * @param res - The response object for sending back updated message or error responses
 */
export const updateMessageStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId, status } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Verify that the requesting user is a participant in the chat
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to update messages in this chat' });
    }
    
    // Find the message in the chat
    const message = chat.messages.id(messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Update message status
    message.status = status;
    await chat.save();
    
    // Notify other participants via socket
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.chatId).emit('message_status_updated', { messageId, status });
    }
    
    res.json({ message: 'Message status updated successfully', updatedMessage: message });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ message: 'Error updating message status' });
  }
};

/**
 * Get user profile information for chat avatars
 * 
 * @param req - The request object containing the user ID
 * @param res - The response object for sending back the user profile data
 */
export const getUserProfileForChat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { userId } = req.params;
    
    // Check if the userId is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    // Get user model
    const User = mongoose.model('User');
    
    // Find the user by ID
    const user = await User.findById(userId).select('firstName lastName email avatar name');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user profile information
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
}; 
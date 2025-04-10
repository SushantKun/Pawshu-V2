/**
 * Chat Routes
 * 
 * Defines API endpoints for chat functionality including fetching chats,
 * getting messages, creating chats, and sending messages.
 */

import express from 'express';
import { verifyToken } from '../middleware/auth';
import { 
  getUserChats, 
  getChatMessages, 
  createChat, 
  sendMessage, 
  updateChatStatus, 
  updateMessageStatus,
  getUserProfileForChat
} from '../controllers/chatController';

const router = express.Router();

// Get all chats for a user
router.get('/', verifyToken, getUserChats);

// Get messages for a specific chat
router.get('/:chatId/messages', verifyToken, getChatMessages);

// Create a new chat or get existing chat
router.post('/', verifyToken, createChat);

// Send a message
router.post('/:chatId/message', verifyToken, sendMessage);

// Update chat active status
router.patch('/:chatId/status', verifyToken, updateChatStatus);

// Update message status in a chat
router.patch('/:chatId/messages/status', verifyToken, updateMessageStatus);

// Get user profile for chat (for displaying avatars, names, etc.)
router.get('/users/:userId', verifyToken, getUserProfileForChat);

export default router; 
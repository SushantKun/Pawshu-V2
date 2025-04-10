import React, { createContext, useContext, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  senderId: string;
  content: string;
  sender: 'user' | 'support' | string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

interface ChatInfo {
  chatId: string;
  recipientId: string;
  recipientName: string;
  reportId?: string;
  reportType?: 'lost' | 'found';
  petType?: string;
}

interface DirectChatParams {
  recipientId: string;
  recipientName: string;
  reportId?: string;
  reportType?: 'lost' | 'found';
  petType?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
}

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: ChatMessage;
}

interface ChatContextProps {
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeChat: Chat | null;
  setActiveChat: React.Dispatch<React.SetStateAction<Chat | null>>;
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  startDirectChat: (userId: string) => Promise<void>;
  fetchChats: () => Promise<void>;
  chats: Chat[];
  loading: boolean;
}

const ChatContext = createContext<ChatContextProps | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentChat, setCurrentChat] = useState<ChatInfo | null>(null);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const API_URL = 'http://localhost:5000/api';

  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const newSocket = io('http://localhost:5000', {
        auth: {
          token: localStorage.getItem('token')
        }
      });

      newSocket.on('connect', () => {
        console.log('Connected to socket server');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from socket server');
        setIsConnected(false);
      });

      newSocket.on('receive_message', (message: any) => {
        // Convert to ChatMessage format
        const chatMessage: ChatMessage = {
          id: message._id || Date.now().toString(),
          senderId: message.sender,
          content: message.content,
          timestamp: new Date(message.timestamp)
        };
        setMessages(prev => [...prev, chatMessage]);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  // Load messages when currentChat changes
  useEffect(() => {
    if (currentChat && user) {
      fetchMessages(currentChat.chatId);
    }
  }, [currentChat, user]);

  const fetchMessages = async (chatId: string) => {
    try {
      const response = await axios.get(`${API_URL}/chats/${chatId}/messages`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data) {
        // Map server messages to ChatMessage format
        const formattedMessages: ChatMessage[] = response.data.map((msg: any) => ({
          id: msg._id || Date.now().toString(),
          senderId: msg.sender, // Use sender as senderId
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      // If there are no messages yet, just show an empty chat
      setMessages([]);
    }
  };

  const startDirectChat = async (userId: string) => {
    if (!user) {
      toast.error('You must be logged in to start a chat');
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if chat already exists with this user
      const existingChat = chats.find(chat => 
        chat.participants.includes(userId) && 
        chat.participants.includes(user._id)
      );
      
      if (existingChat) {
        // Use existing chat
        setActiveChat(existingChat);
        setIsChatOpen(true);
        return;
      }
      
      // Create new chat
      const response = await axios.post(`${API_URL}/chats`, {
        participantId: userId
      });
      
      const newChat = response.data;
      setChats(prev => [...prev, newChat]);
      setActiveChat(newChat);
      setIsChatOpen(true);
      toast.success('Chat started successfully');
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!activeChat || !user) {
      toast.error('No active chat or user not logged in');
      return;
    }
    
    try {
      const response = await axios.post(`${API_URL}/chats/${activeChat.id}/message`, {
        content
      });
      
      const newMessage = response.data;
      // Convert to ChatMessage format
      const chatMessage: ChatMessage = {
        id: newMessage._id || Date.now().toString(),
        senderId: newMessage.sender,
        content: newMessage.content,
        timestamp: new Date(newMessage.timestamp)
      };
      
      setMessages(prev => [...prev, chatMessage]);
      
      // Update last message in chats list
      setChats(prev => 
        prev.map(chat => 
          chat.id === activeChat.id 
            ? { ...chat, lastMessage: chatMessage } 
            : chat
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Fetch user's chats
  const fetchChats = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/chats`);
      setChats(response.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for active chat
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChat) {
        setMessages([]);
        return;
      }
      
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/chats/${activeChat.id}/messages`);
        
        // Convert to ChatMessage format
        const chatMessages: ChatMessage[] = response.data.map((msg: any) => ({
          id: msg._id || Date.now().toString(),
          senderId: msg.sender,
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(chatMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [activeChat]);

  // Load chats on user login
  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user]);

  const value = {
    isChatOpen,
    setIsChatOpen,
    activeChat,
    setActiveChat,
    messages,
    sendMessage,
    startDirectChat,
    fetchChats,
    chats,
    loading
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Alias for backward compatibility
export const useChatContext = useChat; 
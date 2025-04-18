import React, { useRef, useEffect, useState } from 'react';
import { FaPaperPlane, FaCheck } from 'react-icons/fa';
import { BsCheckAll } from 'react-icons/bs';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import UserAvatar from '../UserAvatar';

// Message interface that matches our backend model
interface Message {
  _id: string;
  sender: string | { _id: string; [key: string]: any };  // Handle both string ID and populated sender object
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

// User avatar properties
interface UserAvatar {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string;
}

// Constants for local storage keys
const CURRENT_USER_KEY = 'current-chat-user-id';
const MESSAGES_STORAGE_KEY = 'chat-messages';

const ChatInterface: React.FC<{ 
  chatId?: string, 
  recipientName?: string,
  recipientId?: string,
  reportStatus?: 'open' | 'resolved' | 'closed'
}> = ({ 
  chatId, 
  recipientName = 'User',
  recipientId = '',
  reportStatus = 'open'
}) => {
  const { user } = useAuth();
  const { messages: contextMessages, sendMessage: sendContextMessage, activeChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatIsActive, setChatIsActive] = useState(true);
  const [recipientAvatar, setRecipientAvatar] = useState<UserAvatar | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [socketInstance, setSocketInstance] = useState<any>(null);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [recipientIsOnline, setRecipientIsOnline] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(null);
  const [statusRefreshCounter, setStatusRefreshCounter] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Store user ID in localStorage for consistent reference
  useEffect(() => {
    if (user?._id) {
      localStorage.setItem(CURRENT_USER_KEY, user._id);
    }
  }, [user]);

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    console.log('Initializing socket connection for user:', user._id);
    const token = localStorage.getItem('token');
    console.log('Auth token available:', !!token);
    
    const socket = io('/', {
      path: '/socket.io',
      auth: {
        token: token
      },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('Connected to socket server with socket id:', socket.id);
      setSocketConnected(true);
      if (chatId) {
        console.log('Joining chat room:', chatId, 'as user:', user._id);
        socket.emit('join_chat', { chatId, userId: user._id });
      }
    });

    socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      setSocketConnected(false);
    });

    socket.on('typing', (data: { chatId: string, userId: string }) => {
      console.log('Typing event received:', data);
      if (data.chatId === chatId && data.userId !== user._id) {
        setIsTyping(true);
        
        // Clear previous timeout if exists
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }
        
        // Set timeout to clear typing indicator after 3 seconds
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
        
        setTypingTimeout(timeout);
      }
    });

    socket.on('stop_typing', (data: { chatId: string, userId: string }) => {
      console.log('Stop typing event received:', data);
      if (data.chatId === chatId && data.userId !== user._id) {
        setIsTyping(false);
      }
    });
    
    // Handle user online status changes
    socket.on('user_status_changed', (data: { userId: string, isOnline: boolean, lastActive?: string }) => {
      console.log('User status changed event received:', data);
      if (data.userId === recipientId) {
        console.log(`Setting recipient ${recipientId} status to ${data.isOnline ? 'online' : 'offline'}`);
        setRecipientIsOnline(data.isOnline);
        if (!data.isOnline && data.lastActive) {
          setLastOnlineTime(new Date(data.lastActive));
        }
        // Force refresh counter to trigger the effect
        setStatusRefreshCounter(prev => prev + 1);
      }
    });
    
    // Handle when a user comes online in the chat
    socket.on('user_online', (data: { userId: string, chatId: string }) => {
      console.log('User came online in chat event received:', data);
      if (data.userId === recipientId && data.chatId === chatId) {
        console.log(`User ${recipientId} came online in chat ${chatId}`);
        setRecipientIsOnline(true);
        // Force refresh counter to trigger the effect
        setStatusRefreshCounter(prev => prev + 1);
      }
    });

    // Handle user connected event (simplified approach)
    socket.on('user_connected', (data: { userId: string }) => {
      console.log('User connected event received:', data);
      if (data.userId === recipientId) {
        console.log(`User ${recipientId} connected`);
        setRecipientIsOnline(true);
        setStatusRefreshCounter(prev => prev + 1);
      }
    });

    // Handle user disconnected event (simplified approach)
    socket.on('user_disconnected', (data: { userId: string }) => {
      console.log('User disconnected event received:', data);
      if (data.userId === recipientId) {
        console.log(`User ${recipientId} disconnected`);
        setRecipientIsOnline(false);
        setStatusRefreshCounter(prev => prev + 1);
      }
    });

    setSocketInstance(socket);

    // Check recipient online status when mounting component
    const checkRecipientStatus = async () => {
      if (recipientId) {
        try {
          const response = await axios.get(`http://localhost:5000/api/users/${recipientId}/online-status`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          console.log('Recipient online status from API:', response.data);
          
          // If debug info is available, log it
          if (response.data.debug) {
            console.log('Online status debug info:', response.data.debug);
          }
          
          setRecipientIsOnline(response.data.isOnline);
          if (!response.data.isOnline && response.data.lastActive) {
            setLastOnlineTime(new Date(response.data.lastActive));
          }
        } catch (error) {
          console.error('Error checking recipient online status:', error);
        }
      }
    };
    
    checkRecipientStatus();

    return () => {
      console.log('Disconnecting socket for user:', user._id);
      socket.disconnect();
      setSocketConnected(false);
    };
  }, [user, chatId, recipientId]);

  // Add a polling mechanism to periodically check recipient's online status
  useEffect(() => {
    if (!recipientId || !user) return;

    console.log('Setting up status polling for recipient:', recipientId);
    
    const statusInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/users/${recipientId}/online-status`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        console.log('Polled recipient status:', response.data);
        setRecipientIsOnline(response.data.isOnline);
        if (!response.data.isOnline && response.data.lastActive) {
          setLastOnlineTime(new Date(response.data.lastActive));
        }
      } catch (error) {
        console.error('Error polling recipient status:', error);
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      console.log('Clearing status polling interval');
      clearInterval(statusInterval);
    };
  }, [recipientId, user, statusRefreshCounter]);

  // Add visibility change handler to refresh status when tab becomes visible
  useEffect(() => {
    if (!recipientId) return;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing online status');
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`http://localhost:5000/api/users/${recipientId}/online-status`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          console.log('Refreshed recipient online status:', response.data);
          setRecipientIsOnline(response.data.isOnline);
          if (!response.data.isOnline && response.data.lastActive) {
            setLastOnlineTime(new Date(response.data.lastActive));
          }
        } catch (error) {
          console.error('Error refreshing recipient status:', error);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [recipientId]);
  
  // Keep-alive ping to server
  useEffect(() => {
    if (!user || !socketConnected) return;
    
    console.log('Setting up keep-alive ping for socket connection');
    
    const pingInterval = setInterval(() => {
      if (socketInstance && socketInstance.connected) {
        console.log('Sending ping to server');
        socketInstance.emit('ping', { userId: user._id });
      }
    }, 5000); // Every 5 seconds
    
    return () => {
      console.log('Clearing ping interval');
      clearInterval(pingInterval);
    };
  }, [user, socketInstance, socketConnected]);

  // Update chat active status based on report status changes
  useEffect(() => {
    const updateChatStatus = async () => {
      if (!chatId && !activeChat?.id) return;
      
      const activeChatId = chatId || activeChat?.id;
      const isActive = reportStatus !== 'resolved';
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.patch(
          `http://localhost:5000/api/chats/${activeChatId}/status`, 
          { isActive },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.status === 200) {
          setChatIsActive(isActive);
          console.log(`Chat status updated to ${isActive ? 'active' : 'inactive'}`);
        }
      } catch (error) {
        console.error('Error updating chat status:', error);
      }
    };
    
    updateChatStatus();
  }, [reportStatus, chatId, activeChat]);

  // Fetch recipient's avatar
  useEffect(() => {
    const fetchRecipientAvatar = async () => {
      if (!recipientId) return;
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/users/${recipientId}/profile`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data) {
          setRecipientAvatar({
            _id: response.data._id,
            firstName: response.data.firstName || response.data.avatar?.firstName,
            lastName: response.data.lastName || response.data.avatar?.lastName,
            email: response.data.email,
            avatarUrl: response.data.avatar?.url,
            name: response.data.name
          });
        }
      } catch (error) {
        console.error('Error fetching recipient avatar:', error);
      }
    };
    
    fetchRecipientAvatar();
  }, [recipientId]);
  
  // Mark incoming messages as read
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!user || !messages.length || !chatId) return;
      
      // Find messages from the other person that are not marked as read
      const unreadMessages = messages.filter(msg => 
        !isMessageFromCurrentUser(msg.sender) && 
        msg.status !== 'read'
      );
      
      if (unreadMessages.length === 0) return;
      
      try {
        // Update each unread message status to 'read'
        await Promise.all(unreadMessages.map(async (msg) => {
          const token = localStorage.getItem('token');
          await axios.patch(
            `http://localhost:5000/api/chats/${chatId}/messages/status`,
            { 
              messageId: msg._id,
              status: 'read'
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }));
        
        // Update local state
        setMessages(prev => prev.map(msg => 
          !isMessageFromCurrentUser(msg.sender) ? { ...msg, status: 'read' } : msg
        ));
        
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };
    
    // Only mark messages as read when the chat is visible/focused
    markMessagesAsRead();
  }, [messages, chatId, user]);
  
  // Core function to determine if a message is from the current user
  // This handles both string IDs and populated sender objects
  const isMessageFromCurrentUser = (sender: string | { _id: string; [key: string]: any }): boolean => {
    if (!user) return false;

    // Handle when sender is a populated object (with _id field)
    if (typeof sender === 'object' && sender !== null && '_id' in sender) {
      return sender._id === user._id;
    }
    
    // Handle when sender is just a string ID
    return sender === user._id;
  };

  // Function to notify when user is typing
  const handleTyping = () => {
    if (!socketInstance || !chatId || !user) return;
    
    socketInstance.emit('typing', { chatId, userId: user._id });
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set timeout to emit stop typing event after 3 seconds
    const timeout = setTimeout(() => {
      socketInstance.emit('stop_typing', { chatId, userId: user._id });
    }, 3000);
    
    setTypingTimeout(timeout);
  };

  // Fetch messages from API directly
  const fetchMessages = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Use either the passed chatId prop or the activeChat from context
      const activeChatId = chatId || (activeChat?.id);
      
      if (activeChatId) {
        const token = localStorage.getItem('token');
        console.log('Fetching messages for chat ID:', activeChatId);

        const response = await axios.get(`http://localhost:5000/api/chats/${activeChatId}/messages`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (Array.isArray(response.data)) {
          console.log('Raw message data:', response.data);
          setMessages(response.data);
        }
      } else if (contextMessages && contextMessages.length > 0) {
        // Fallback to context messages if available
        const formattedMessages = contextMessages.map(msg => ({
          _id: msg.id,
          sender: msg.senderId,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          status: 'sent' as const
        }));
        
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Fallback to empty messages list
    } finally {
      setLoading(false);
    }
  };

  // Initial message fetch
  useEffect(() => {
    fetchMessages();
  }, [user, chatId, activeChat, contextMessages]);

  // Background polling for new messages (every 15 seconds)
  useEffect(() => {
    if (!chatId) return;
    
    const intervalId = setInterval(() => {
      fetchMessages();
    }, 15000);
    
    return () => clearInterval(intervalId);
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-focus on input when chat opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Store messages in localStorage to maintain positions during refreshes
  useEffect(() => {
    if (messages.length > 0 && chatId) {
      localStorage.setItem(`${MESSAGES_STORAGE_KEY}-${chatId}`, JSON.stringify(messages));
    }
  }, [messages, chatId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    
    // Strict enforcement: never send messages if report is resolved
    if (reportStatus === 'resolved' || !chatIsActive) {
      toast.error('This report has been resolved. Messages cannot be sent.');
      setNewMessage('');
      return;
    }
    
    // Try to use context sendMessage if available
    if (activeChat && sendContextMessage) {
      try {
        await sendContextMessage(newMessage);
        setNewMessage('');
        return;
      } catch (error) {
        console.error('Failed to send message via context:', error);
      }
    }
    
    // Fallback to direct API call
    try {
      const activeChatId = chatId || (activeChat?.id);
      
      if (activeChatId) {
        const token = localStorage.getItem('token');
        
        const response = await axios.post(`http://localhost:5000/api/chats/${activeChatId}/message`, 
          { content: newMessage },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data) {
          // Add the new message to our local state
          setMessages(prevMessages => [...prevMessages, {
            _id: response.data._id || Date.now().toString(),
            sender: user._id, // Use the actual user ID
            content: newMessage,
            timestamp: new Date(),
            status: 'sent'
          }]);
        }
      } else {
        // For demo - just add locally if no activeChat
        setMessages(prevMessages => [...prevMessages, {
          _id: Date.now().toString(),
          sender: user._id, // Use the actual user ID
          content: newMessage,
          timestamp: new Date(),
          status: 'sent'
        }]);
      }
      
      setNewMessage('');
      
      // Clear typing indicator
      if (socketInstance && chatId) {
        socketInstance.emit('stop_typing', { chatId, userId: user._id });
      }
      
      // Focus input after sending
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format the date for display
  const formatMessageDate = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if the message is from today
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    // Check if the message is from yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise, return the full date
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get avatar component for user
  const getAvatarComponent = (userId: string, name: string = '') => {
    // If it's the recipient and we have their avatar
    if (recipientAvatar && userId === recipientId) {
      return (
        <UserAvatar 
          url={recipientAvatar.avatarUrl}
          name={recipientAvatar.firstName || recipientAvatar.name || recipientName}
          email={recipientAvatar.email}
          size="md"
          bgColor="bg-blue-600"
          id={recipientAvatar._id}
        />
      );
    }
    
    // If it's the current user
    if (userId === user?._id) {
      return (
        <UserAvatar 
          url={user.avatar?.url}
          name={user.firstName || user.name || 'Me'}
          email={user.email}
          size="sm"
          id={user._id}
        />
      );
    }
    
    // Fallback avatar
    return (
      <UserAvatar 
        name={name || 'User'}
        size="sm"
        bgColor="bg-gray-500"
      />
    );
  };

  // Group messages by date for better display
  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const dateKey = new Date(message.timestamp).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    return Object.entries(groups).map(([date, msgs]) => ({
      date: new Date(date),
      messages: msgs
    }));
  };

  // Helper to safely get sender ID from message
  const getSenderId = (sender: string | { _id: string; [key: string]: any }): string => {
    return typeof sender === 'object' && sender !== null ? sender._id : sender as string;
  };

  // Render message status indicators
  const renderMessageStatus = (status: string) => {
    switch (status) {
      case 'sent':
        return <FaCheck className="text-gray-400 ml-1" size={10} />;
      case 'delivered':
        return <FaCheck className="text-blue-400 ml-1" size={10} />;
      case 'read':
        return (
          <span className="flex ml-1">
            <FaCheck className="text-blue-500 -mr-1" size={10} />
            <FaCheck className="text-blue-500" size={10} />
          </span>
        );
      default:
        return null;
    }
  };

  // Enhance the formatLastOnline function to be more precise
  const formatLastOnline = (date: Date | null): string => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    // More precise time display
    if (diffSecs < 30) return 'just now';
    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-gray-900 text-white flex flex-col h-full max-h-[calc(100vh-8rem)] rounded-lg overflow-hidden">
      {/* Chat header */}
      <div className="bg-blue-600 p-4 flex items-center justify-between">
        <div className="flex items-center">
          {recipientAvatar && (
            <div className="mr-3">
              {getAvatarComponent(recipientAvatar._id, recipientAvatar.firstName)}
            </div>
          )}
          <div>
            <h3 className="font-semibold">{recipientName}</h3>
            <p className="text-xs text-blue-100">
              {recipientIsOnline ? (
                <span className="text-green-400 flex items-center">
                  <span className="h-2 w-2 rounded-full bg-green-400 inline-block mr-1"></span>
                  Online
                </span>
              ) : (
                <span className="text-gray-300">
                  {lastOnlineTime ? formatLastOnline(lastOnlineTime) : 'Offline'}
                </span>
              )}
            </p>
          </div>
        </div>
        <button 
          onClick={() => window.history.back()} 
          className="p-2 rounded-full hover:bg-blue-700 transition-colors"
          aria-label="Back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4" ref={messagesEndRef}>
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-4">
            {groupMessagesByDate().map((group, groupIndex) => (
              <div key={groupIndex} className="message-group">
                <div className="text-center text-xs text-gray-400 my-2">
                  {String(group.date)}
                </div>
                <div className="space-y-2">
                  {group.messages.map((message) => {
                    const isMine = isMessageFromCurrentUser(message.sender);
                    return (
                      <div 
                        key={message._id} 
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] rounded-lg px-4 py-2 ${
                          isMine ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'
                        }`}>
                          <div className="mb-1">{message.content}</div>
                          <div className="text-xs text-right flex justify-end items-center">
                            <span className="opacity-75 mr-1">
                              {formatMessageDate(new Date(message.timestamp))}
                            </span>
                            {isMine && renderMessageStatus(message.status)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No messages yet</p>
            <p className="text-sm mt-2">Be the first to say hello!</p>
          </div>
        )}
        
        {/* Typing indicator */}
        {isTyping && (
          <div className="text-gray-400 text-sm mt-2 animate-pulse">
            {recipientName} is typing...
          </div>
        )}
      </div>
      
      {/* Message input */}
      <div className="p-4 border-t border-gray-700">
        {chatIsActive && reportStatus !== 'resolved' ? (
          <div className="flex">
            <input
              type="text"
              ref={inputRef}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-gray-700 text-white border-0 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={!socketConnected}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || !socketConnected}
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-r-lg flex items-center ${
                !newMessage.trim() || !socketConnected ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <FaPaperPlane />
            </button>
          </div>
        ) : (
          <div className="bg-yellow-800 text-yellow-200 p-3 rounded-lg text-sm text-center">
            This conversation is no longer active because the related report has been resolved.
          </div>
        )}
        
        {!socketConnected && (
          <div className="text-red-400 text-xs mt-2">
            <span className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block mr-1"></span>
              Disconnected. Please refresh the page.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
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
  
  // Store user ID in localStorage for consistent reference
  useEffect(() => {
    if (user?._id) {
      localStorage.setItem(CURRENT_USER_KEY, user._id);
    }
  }, [user]);

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;

    const socket = io('http://localhost:5000', {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    socket.on('connect', () => {
      console.log('Connected to socket server');
      if (chatId) {
        socket.emit('join_chat', { chatId });
      }
    });

    socket.on('typing', (data: { chatId: string, userId: string }) => {
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
      if (data.chatId === chatId && data.userId !== user._id) {
        setIsTyping(false);
      }
    });

    setSocketInstance(socket);

    return () => {
      socket.disconnect();
    };
  }, [user, chatId]);
  
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
          name={recipientAvatar.firstName || recipientAvatar.name || name || recipientAvatar.email}
          email={recipientAvatar.email}
          size="sm"
          bgColor="bg-indigo-500"
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

  return (
    <div className="w-full h-[500px] flex flex-col bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-blue-600 flex items-center">
        <div className="mr-3">
          {recipientId ? getAvatarComponent(recipientId, recipientName) : (
            <UserAvatar
              name={recipientName}
              size="sm"
              bgColor="bg-blue-700"
            />
          )}
        </div>
        <div>
          <h2 className="font-semibold text-white">{recipientName}</h2>
          {reportStatus === 'resolved' ? (
            <span className="text-xs bg-green-500 px-2 py-0.5 rounded-full text-white">Resolved</span>
          ) : isTyping ? (
            <span className="text-xs text-green-200">typing...</span>
          ) : (
            <span className="text-xs text-blue-200">Online</span>
          )}
        </div>
        <button className="ml-auto text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-center">
              No messages yet. Start a conversation!
            </p>
          </div>
        ) : (
          <>
            {groupMessagesByDate().map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-4">
                {/* Date separator */}
                <div className="flex justify-center my-2">
                  <div className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">
                    {formatMessageDate(group.date)}
                  </div>
                </div>
                
                {/* Messages in this group */}
                {group.messages.map((message, messageIndex) => {
                  // Directly check if the sender is the current user
                  const isFromMe = isMessageFromCurrentUser(message.sender);
                  const senderId = getSenderId(message.sender);
                  
                  // Check if this is a sequence of messages from the same sender
                  const isSequential = messageIndex > 0 && 
                    getSenderId(group.messages[messageIndex - 1].sender) === senderId;
                  
                  return (
                    <div 
                      key={message._id} 
                      className={`flex ${isFromMe ? "justify-end" : "justify-start"} ${isSequential ? "mt-1" : "mt-4"}`}
                    >
                      {/* Avatar for non-sequential other user messages */}
                      {!isFromMe && !isSequential && (
                        <div className="flex-shrink-0 mr-2">
                          {getAvatarComponent(senderId, '')}
                        </div>
                      )}
                      
                      {/* Message content with conditional styling */}
                      <div className={`
                        max-w-[70%] p-3 rounded-lg
                        ${isFromMe 
                          ? "bg-blue-500 text-white rounded-br-none" 
                          : "bg-gray-700 text-white rounded-bl-none"}
                        ${isSequential && !isFromMe ? "ml-10" : ""}
                      `}>
                        <p className="break-words">{message.content}</p>
                        <div className="flex justify-end items-center mt-1 text-xs opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                          {isFromMe && renderMessageStatus(message.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start mt-2">
                <div className="bg-gray-700 px-4 py-2 rounded-full flex items-center">
                  <div className="mr-2">
                    {recipientId ? getAvatarComponent(recipientId, recipientName) : (
                      <UserAvatar
                        name={recipientName}
                        size="sm"
                        bgColor="bg-blue-700"
                      />
                    )}
                  </div>
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Area */}
      {reportStatus === 'resolved' ? (
        <div className="p-4 bg-gray-800 border-t border-gray-700 text-center">
          <div className="bg-green-500 text-white p-3 rounded-md">
            <p>This issue has been resolved. Thank you for your help!</p>
            <p className="text-xs mt-1 text-white opacity-80">Messaging for this report has been disabled.</p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onInput={handleTyping}
              placeholder="Type a message..."
              className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || loading}
              className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              role="send"
            >
              <FaPaperPlane size={18} />
            </button>
          </div>
        </div>
      )}
      
      {/* CSS for the typing indicator */}
      <style>
        {`
        .typing-indicator {
          display: flex;
          align-items: center;
        }
        
        .typing-indicator span {
          height: 8px;
          width: 8px;
          margin: 0 1px;
          background-color: #9ca3af;
          border-radius: 50%;
          display: inline-block;
          animation: typing 1.4s infinite ease-in-out both;
        }
        
        .typing-indicator span:nth-child(1) {
          animation-delay: 0s;
        }
        
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typing {
          0%, 100% {
            transform: scale(0.7);
            opacity: 0.5;
          }
          50% {
            transform: scale(1);
            opacity: 1;
          }
        }
        `}
      </style>
    </div>
  );
};

export default ChatInterface;
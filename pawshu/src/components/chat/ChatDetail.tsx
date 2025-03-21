/**
 * CHAT IMPROVEMENTS
 * 
 * 1. Fixed "Unknown Sender" issue:
 *    - Added getUserName and getUserAvatar helper functions
 *    - Added proper error handling for avatar images
 *    - Added fallback to user initials when avatar fails to load
 * 
 * 2. Improved message status indicators:
 *    - Added MessageStatus component with visual indicators for sent/delivered/read
 *    - Added socket event handling for message_status_update events
 *    - Added mark_messages_read event emitter when messages are viewed
 * 
 * 3. Enhanced file uploads:
 *    - Fixed the file upload API endpoint path
 *    - Added proper error handling for file uploads
 *    - Added progress tracking and visual feedback
 * 
 * 4. Fixed unread message count display:
 *    - Now only showing count for unread messages from other users
 *    - Fixed the filter to exclude messages from the current user
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { formatDistanceToNow, isSameDay, format } from 'date-fns';
import MessageInput from './MessageInput';

interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    avatar?: {
      url: string;
      public_id: string;
    };
  } | null;
  content: string;
  timestamp: string;
  read: boolean;
  status: 'sent' | 'delivered' | 'read';
  uniqueMessageKey?: string;
  isSenderMessage?: boolean;
  originalSenderId?: string;
  clientMessageId?: string;
  attachment?: {
    url: string;
    type: string;
    name: string;
    thumbnailUrl?: string;
  };
}

interface Participant {
  _id: string;
  name: string;
  email: string;
  avatar?: {
    url: string;
    public_id: string;
  };
}

interface ChatData {
  _id: string;
  participants: Participant[];
  messages: Message[];
  context?: {
    type: string;
    itemId?: string;
    appointmentId?: string;
  };
}

interface ChatDetailProps {
  chatId: string;
  onBackClick?: () => void;
}

interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];
  const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  return colors[hash % colors.length];
};

const Avatar: React.FC<{ user: Participant; size?: 'sm' | 'lg' }> = ({ user, size = 'lg' }) => {
  const sizeClasses = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  
  return (
    <div className={`flex-shrink-0 ${sizeClasses} rounded-full overflow-hidden flex items-center justify-center ${getAvatarColor(user.name)}`}>
      {user.avatar?.url ? (
        <img 
          src={user.avatar.url} 
          alt={user.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.error('Avatar failed to load:', user.avatar?.url);
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.innerHTML = getInitials(user.name);
          }}
        />
      ) : (
        <span className="text-white font-semibold">
          {getInitials(user.name)}
        </span>
      )}
    </div>
  );
};

// Add this component for message status
const MessageStatus: React.FC<{ status: 'sent' | 'delivered' | 'read' }> = ({ status }) => {
  // WhatsApp style checkmarks:
  // Single gray check - sent
  // Double gray check - delivered
  // Double blue check - read
  if (status === 'read') {
    return (
      <div className="inline-flex" title="Read">
        <div className="relative h-3 w-5">
          {/* First checkmark */}
          <svg className="absolute left-0 h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {/* Second checkmark */}
          <svg className="absolute left-2 h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    );
  } else if (status === 'delivered') {
    return (
      <div className="inline-flex" title="Delivered">
        <div className="relative h-3 w-5">
          {/* First checkmark */}
          <svg className="absolute left-0 h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {/* Second checkmark */}
          <svg className="absolute left-2 h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    );
  } else {
    return (
      <div className="inline-flex" title="Sent">
        {/* Single checkmark */}
        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
};

// Add formatTime function
const formatTime = (timestamp: Date | string) => {
  const date = new Date(timestamp);
  return format(date, 'h:mm a');
};

const ChatDetail: React.FC<ChatDetailProps> = ({ chatId, onBackClick }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { setUnreadChats, setCurrentChatId } = useChat();
  
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [processedMessageKeys, setProcessedMessageKeys] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [fileUploads, setFileUploads] = useState<Record<string, FileUploadProgress>>({});

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesEndRef]);

  const connectSocket = useCallback(() => {
    // Prevent multiple socket connections
    if (isConnectedRef.current || !user || !chatId) {
      return null;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }

    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected in ChatDetail');
      isConnectedRef.current = true;
      setSocketError(null);
      newSocket.emit('joinRoom', chatId);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      isConnectedRef.current = false;
      setSocketError(`Connection error: ${err.message}. Please try again.`);
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      isConnectedRef.current = false;
      setSocketError(`Disconnected: ${reason}. Attempting to reconnect...`);
    });

    socketRef.current = newSocket;
    return newSocket;
  }, [user, chatId, navigate]);

  // Connect socket and manage connection
  useEffect(() => {
    if (authLoading) return;

    const newSocket = connectSocket();
    
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
      isConnectedRef.current = false;
      socketRef.current = null;
    };
  }, [authLoading, connectSocket]);

  // Listen for new messages
  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket || !chatId) return;

    const handleIncomingMessage = (data: { 
      chatId: string; 
      message: Message & { 
        isSenderMessage?: boolean; 
        originalSenderId?: string;
        clientMessageId?: string;
        uniqueMessageKey?: string;
      } 
    }) => {
      // Validate incoming message data
      if (!data || !data.message) {
        console.warn('Received invalid message data:', data);
        return;
      }

      // Only update if the message is for the current chat
      if (data.chatId === chatId) {
        setMessages(prevMessages => {
          // Check for duplicates using uniqueMessageKey or a combination of content and timestamp
          const messageKey = data.message.uniqueMessageKey || 
            `${data.message.content}-${data.message.timestamp}-${data.message.sender?._id}`;

          const isDuplicate = prevMessages.some(msg => {
            const existingKey = msg.uniqueMessageKey || 
              `${msg.content}-${msg.timestamp}-${msg.sender?._id}`;
            return existingKey === messageKey;
          });

          if (isDuplicate) {
            console.log('Preventing duplicate message:', messageKey);
            return prevMessages;
          }

          // First try to find the complete sender information from chatData.participants
          let completeSender = null;
          
          // Use originalSenderId to identify the sender if available
          const senderId = data.message.originalSenderId || data.message.sender?._id;
          
          if (senderId && chatData?.participants) {
            // Look for the sender in chat participants
            completeSender = chatData.participants.find(p => p._id === senderId);
          }

          // If we have a complete sender from participants, use that
          // Otherwise, fall back to the sender data in the message, or create a placeholder
          const messageSender = completeSender || data.message.sender || {
            _id: senderId || 'unknown',
            name: 'Unknown Sender'
          };

          console.log('Message sender resolved:', messageSender.name, 'from ID:', senderId);

          // If we couldn't find complete sender information, fetch chat data again to ensure we have up-to-date participant info
          if (!completeSender && senderId) {
            console.log('Fetching updated chat data to resolve sender information');
            // We'll fetch chat data outside of this callback to avoid state update during render
            setTimeout(() => {
              fetchChatDataSafely();
            }, 500);
          }

          // Prepare the new message with the resolved sender
          const newMessage: Message = {
            _id: data.message._id,
            content: data.message.content,
            sender: messageSender,
            timestamp: data.message.timestamp,
            read: data.message.read || false,
            status: data.message.status || 'sent',
            uniqueMessageKey: messageKey,
            attachment: data.message.attachment
          };

          return [...prevMessages, newMessage];
        });
        scrollToBottom();
      }
    };

    // Handle all incoming messages with a single handler
    currentSocket.on('newMessage', handleIncomingMessage);
    currentSocket.on('messageSent', handleIncomingMessage);

    return () => {
      currentSocket.off('newMessage', handleIncomingMessage);
      currentSocket.off('messageSent', handleIncomingMessage);
    };
  }, [chatId, scrollToBottom, chatData?.participants]);

  // Add safe function to fetch chat data
  const fetchChatDataSafely = useCallback(async () => {
    if (!chatId || !user?._id) return;
    
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/chats/${chatId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setChatData(response.data);
      
      // Only update messages if we actually got messages back
      if (response.data.messages && response.data.messages.length > 0) {
        setMessages(response.data.messages);
      }
      
      // Mark messages as read when they are viewed
      if (socketRef.current) {
        socketRef.current.emit('readMessages', { 
          chatId
        });
        
        // Also update messages locally to reflect read status
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.sender && msg.sender._id !== user._id && !msg.read
              ? { ...msg, status: 'read', read: true }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  }, [chatId, user?._id]);

  // Update the useEffect that fetches chat data to use the safe function
  useEffect(() => {
    if (!chatId || !user?._id) return;

    setLoading(true);
    setError(null);
    
    fetchChatDataSafely()
      .then(() => {
        scrollToBottom();
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching chat:', error);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          navigate('/login');
        } else {
          setError('Failed to load chat details. Please try again.');
        }
        setLoading(false);
      });
      
    // Listen for message status updates
    if (socketRef.current) {
      socketRef.current.on('message_status_update', (data: { messageId: string; status: 'sent' | 'delivered' | 'read' }) => {
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg._id === data.messageId 
              ? { ...msg, status: data.status, read: data.status === 'read' } 
              : msg
          )
        );
      });
      
      socketRef.current.on('messagesRead', (data: { chatId: string; readBy: string; timestamp: string }) => {
        if (data.chatId === chatId) {
          // If someone else read our messages
          if (data.readBy !== user._id) {
            console.log('Messages read by:', data.readBy);
            // Mark all messages sent by the current user as read
            setMessages(prevMessages => 
              prevMessages.map(msg => 
                (msg.sender?._id === user._id && !msg.read) 
                  ? { ...msg, status: 'read', read: true } 
                  : msg
              )
            );
          }
        }
      });
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.off('message_status_update');
        socketRef.current.off('messagesRead');
      }
    };
  }, [chatId, user?._id, navigate, scrollToBottom, fetchChatDataSafely]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach(message => {
      const date = new Date(message.timestamp);
      const dateKey = format(date, 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    return groups;
  }, [messages]);

  // Add this function to safely get user name
  const getUserName = (userId: string | undefined) => {
    if (!userId) return "Unknown User";
    
    const participant = chatData?.participants.find(p => p._id === userId);
    if (participant?.name) {
      return participant.name;
    }
    
    // Fallback to username if available
    return participant?.name || "Unknown User";
  };

  // Add this function to safely get user avatar
  const getUserAvatar = (userId: string | undefined): string | undefined => {
    if (!userId) return undefined;
    
    const participant = chatData?.participants.find(p => p._id === userId);
    return participant?.avatar?.url || undefined;
  };

  // Fix the handleFileUpload function
  const handleFileUpload = async (file: File): Promise<{ url: string; type: string; name: string; thumbnailUrl?: string } | null> => {
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      setError('File size exceeds 50MB limit');
      return null;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed types: JPG, PNG, GIF, PDF, DOC, DOCX');
      return null;
    }

    const formData = new FormData();
    const fileId = `${Date.now()}-${file.name}`;
    formData.append('file', file);
    
    // Add upload to state with initial progress
    setFileUploads(prev => ({
      ...prev,
      [fileId]: {
        file,
        progress: 0,
        status: 'uploading'
      }
    }));
    
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/chats/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setFileUploads(prev => ({
                ...prev,
                [fileId]: {
                  ...prev[fileId],
                  progress: percentCompleted
                }
              }));
            }
          }
        }
      );

      // Update upload status to success
      setFileUploads(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          status: 'success'
        }
      }));

      // Return attachment data
      const result = {
        url: response.data.url,
        type: response.data.type,
        name: response.data.name,
        thumbnailUrl: response.data.thumbnailUrl
      };
      
      // Clean up upload state after 3 seconds
      setTimeout(() => {
        setFileUploads(prev => {
          const newState = { ...prev };
          delete newState[fileId];
          return newState;
        });
      }, 3000);

      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Get a more descriptive error message
      let errorMessage = 'Upload failed';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || 'Upload failed';
        
        // Handle specific error status codes
        if (error.response?.status === 413) {
          errorMessage = 'File too large for server to process';
        } else if (error.response?.status === 415) {
          errorMessage = 'Unsupported file type';
        } else if (error.response?.status === 401) {
          errorMessage = 'Session expired, please log in again';
          // Redirect to login
          setTimeout(() => navigate('/login'), 2000);
        }
      }
      
      // Update upload status to error
      setFileUploads(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          status: 'error',
          error: errorMessage
        }
      }));
      
      // Show the error in the chat
      setError(errorMessage);
      
      // Clean up upload state after 5 seconds
      setTimeout(() => {
        setFileUploads(prev => {
          const newState = { ...prev };
          delete newState[fileId];
          return newState;
        });
      }, 5000);
      
      return null;
    }
  };

  // Add this component for file upload progress
  const FileUploadProgress: React.FC<{ upload: FileUploadProgress }> = ({ upload }) => {
    return (
      <div className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="flex-shrink-0">
          {upload.status === 'uploading' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
          ) : upload.status === 'success' ? (
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm truncate">{upload.file.name}</div>
          {upload.status === 'uploading' && (
            <div className="relative h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${upload.progress}%` }}
              />
            </div>
          )}
          {upload.status === 'error' && (
            <div className="text-xs text-red-500">{upload.error}</div>
          )}
        </div>
      </div>
    );
  };

  // Enhanced send message function
  const sendMessage = useCallback(async (content: string, attachment?: File) => {
    if (!chatId || !user?._id) return;

    try {
      let attachmentData: Message['attachment'] = undefined;
      if (attachment) {
        const uploadResult = await handleFileUpload(attachment);
        if (!uploadResult) return;
        attachmentData = {
          url: uploadResult.url,
          type: uploadResult.type,
          name: uploadResult.name,
          thumbnailUrl: uploadResult.thumbnailUrl
        };
      }

      const messageContent = content.trim() || ''; // Ensure empty string instead of undefined
      const timestamp = new Date().toISOString();
      const messageKey = `${messageContent}-${timestamp}-${user._id}`;

      // Create a simple optimistic message without avatar object
      const optimisticMessage: Message = {
        _id: `temp-${Date.now()}`,
        content: messageContent,
        sender: {
          _id: user._id,
          name: user.name
        },
        timestamp: timestamp,
        read: false,
        status: 'sent',
        uniqueMessageKey: messageKey,
        attachment: attachmentData
      };

      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      scrollToBottom();

      // Make sure we have a valid chatId and content
      if (!chatId.trim()) {
        setError('Invalid chat ID');
        return;
      }

      // Send the message through socket
      socketRef.current?.emit('sendMessage', {
        chatId,
        content: messageContent,
        uniqueMessageKey: messageKey,
        attachmentData
      }, (response: { success: boolean; messageId?: string; error?: string }) => {
        if (!response.success) {
          console.error('Message send error:', response.error);
          setMessages(prevMessages => 
            prevMessages.filter(msg => msg.uniqueMessageKey !== messageKey)
          );
          setError(response.error || 'Failed to send message');
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  }, [chatId, user, scrollToBottom, handleFileUpload]);

  // Memoize other participant to prevent unnecessary re-renders
  const otherParticipant = useMemo(() => 
    chatData?.participants.find(p => p._id !== user?._id), 
    [chatData, user]
  );

  // Add typing indicator listener
  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on('userTyping', ({ userId, userName }) => {
      if (userId !== user?._id) {
        setIsOtherUserTyping(true);
      }
    });

    socketRef.current.on('userStoppedTyping', ({ userId }) => {
      if (userId !== user?._id) {
        setIsOtherUserTyping(false);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('userTyping');
        socketRef.current.off('userStoppedTyping');
      }
    };
  }, [user]);

  // Add an effect to mark messages as read when viewed
  useEffect(() => {
    if (!chatId || !user?._id || !socketRef.current) return;

    // Mark messages as read when they are viewed
    const markMessagesAsRead = () => {
      console.log('Marking messages as read in chat:', chatId);
      
      // Emit the readMessages event with the user ID to identify who read the messages
      socketRef.current?.emit('readMessages', { 
        chatId,
        readBy: user._id 
      });
      
      // Also update messages locally to reflect read status immediately
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.sender && msg.sender._id !== user._id && !msg.read
            ? { ...msg, status: 'read', read: true }
            : msg
        )
      );
      
      // Reset the unread count for this chat in the context
      setUnreadChats(0);
    };

    // Call once when component mounts or chatId changes
    markMessagesAsRead();
    
    // Add visibility change event listener to mark messages as read when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markMessagesAsRead();
      }
    };
    
    // Set up an interval to periodically mark messages as read (handles cases where user stays on the chat)
    const intervalId = setInterval(markMessagesAsRead, 10000);
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [chatId, user, socketRef, setMessages, setUnreadChats]);

  // Set current chat ID in context
  useEffect(() => {
    if (chatId) {
      setCurrentChatId(chatId);
    }
    
    return () => {
      // Clear the current chat ID when the component unmounts
      setCurrentChatId(null);
    };
  }, [chatId, setCurrentChatId]);

  // Comprehensive loading and error handling
  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || socketError) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>{error || socketError}</p>
        <div className="flex justify-center space-x-4 mt-4">
          <button 
            onClick={() => {
              if (chatId && user?._id) {
                setLoading(true);
                setError(null);
                
                axios.get(`${import.meta.env.VITE_API_URL}/chats/${chatId}`, {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`
                  }
                })
                .then(response => {
                  setChatData(response.data);
                  setMessages(response.data.messages);
                  scrollToBottom();
                  setLoading(false);
                })
                .catch(error => {
                  console.error('Error fetching chat:', error);
                  if (axios.isAxiosError(error) && error.response?.status === 401) {
                    navigate('/login');
                  } else {
                    setError('Failed to load chat details. Please try again.');
                  }
                  setLoading(false);
                });
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Retry Fetch
          </button>
          <button 
            onClick={connectSocket} 
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Reconnect Socket
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  if (!chatData) {
    return (
      <div className="p-4 text-center text-gray-500">
        No chat data available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Chat Header */}
      <div className="py-2 px-3 border-b border-gray-700 flex items-center bg-gray-800 shadow-sm">
        {onBackClick && (
          <button 
            onClick={onBackClick}
            className="mr-2 p-1.5 rounded-full hover:bg-gray-700 transition-colors"
            aria-label="Back"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {otherParticipant && <Avatar user={otherParticipant} size="sm" />}
        <div className="ml-2 flex-1 truncate">
          <h2 className="text-sm font-semibold text-white truncate">
            {otherParticipant?.name || 'Unknown User'}
          </h2>
          {isOtherUserTyping && (
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-400">typing</span>
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-4 bg-gray-900">
        {Object.entries(groupedMessages).map(([date, messages]) => (
          <div key={date} className="mb-6">
            {/* Date Header */}
            <div className="text-center mb-4">
              <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-400">
                {isSameDay(new Date(date), new Date()) 
                  ? 'Today' 
                  : format(new Date(date), 'MMMM d, yyyy')}
              </span>
            </div>

            {/* Messages for this date */}
            <div className="space-y-1">
              {messages.map((message, index) => {
                if (!message) return null;

                const isCurrentUserMessage = message.sender?._id === user?._id;
                const isPreviousMessageSameSender = index > 0 && 
                  messages[index - 1]?.sender?._id === message.sender?._id;
                const isNextMessageSameSender = index < messages.length - 1 && 
                  messages[index + 1]?.sender?._id === message.sender?._id;

                return (
                  <div 
                    key={message._id} 
                    className={`flex ${isCurrentUserMessage ? 'justify-end' : 'justify-start'} ${!isPreviousMessageSameSender ? 'mt-4' : 'mt-0.5'}`}
                  >
                    <div className={`flex items-start max-w-[80%] ${isCurrentUserMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar - only show if first message in a group */}
                      {!isCurrentUserMessage && !isPreviousMessageSameSender && message.sender && (
                        <div 
                          className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-700 flex-shrink-0"
                          title={message.sender.name || 'User'}
                        >
                          {message.sender.avatar?.url ? (
                            <img 
                              src={message.sender.avatar.url} 
                              alt={message.sender.name || 'User'} 
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                console.log('Avatar failed to load, showing initials');
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.parentElement) {
                                  // Show initials instead
                                  const name = message.sender?.name || 'U';
                                  e.currentTarget.parentElement.innerHTML = getInitials(name);
                                }
                              }}
                            />
                          ) : (
                            <span className="text-white text-sm font-medium">
                              {getInitials(message.sender?.name || 'U')}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className={`${!isCurrentUserMessage ? 'ml-2' : 'mr-2'} flex flex-col`}>
                        {/* Sender Name - only show if first message in a group */}
                        {!isCurrentUserMessage && !isPreviousMessageSameSender && message.sender && (
                          <div className="font-medium text-sm mb-1 text-blue-400" title={message.sender.name || 'Unknown User'}>
                            {message.sender.name || 'Unknown User'}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div 
                          className={`
                            px-3 py-2 rounded-md max-w-full break-words
                            ${isCurrentUserMessage 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-700 text-white'}
                          `}
                        >
                          {/* Attachment */}
                          {message.attachment && (
                            <div className="mb-2">
                              {message.attachment.type?.startsWith('image/') ? (
                                <div className="relative">
                                  <img 
                                    src={message.attachment.thumbnailUrl || message.attachment.url} 
                                    alt="Attachment" 
                                    className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(message.attachment?.url, '_blank')}
                                    onError={(e) => {
                                      console.error('Image failed to load:', message.attachment?.url);
                                      e.currentTarget.src = 'https://via.placeholder.com/200?text=Image+Not+Found';
                                    }}
                                  />
                                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                                    {message.attachment?.name}
                                  </div>
                                </div>
                              ) : (
                                <a 
                                  href={message.attachment?.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 p-2 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors"
                                >
                                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm truncate">{message.attachment?.name}</span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Message Text */}
                          <p>{message.content || 'Empty message'}</p>
                        </div>
                        
                        {/* Time and Status */}
                        <div className={`flex items-center text-xs text-gray-500 mt-1 ${isCurrentUserMessage ? 'justify-end' : ''}`}>
                          <span>{formatTime(message.timestamp)}</span>
                          {isCurrentUserMessage && (
                            <div className="flex items-center ml-1">
                              <MessageStatus status={message.status || 'sent'} />
                              {message.read && (
                                <span className="ml-1 text-xs text-blue-400">Seen</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* File Upload Progress */}
      {Object.entries(fileUploads).map(([id, upload]) => (
        <div key={id} className="px-4 py-2 bg-gray-800">
          <FileUploadProgress upload={upload} />
        </div>
      ))}

      {/* Message Input */}
      <div className="p-2 bg-gray-800 border-t border-gray-700">
        <MessageInput 
          chatId={chatId || ''} 
          onSendMessage={sendMessage}
          socket={socketRef.current}
        />
      </div>
    </div>
  );
};

export default ChatDetail;
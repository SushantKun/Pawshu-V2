import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow, isSameDay, format } from 'date-fns';
import MessageInput from './MessageInput';

interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
  } | null;
  content: string;
  timestamp: string;
  read: boolean;
  uniqueMessageKey?: string;
  isSenderMessage?: boolean;
  originalSenderId?: string;
  clientMessageId?: string;
  attachment?: {
    url: string;
    type: string;
    name: string;
  };
}

interface Participant {
  _id: string;
  name: string;
  email: string;
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

const ChatDetail: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
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

          // Prepare the new message
          const newMessage: Message = {
            _id: data.message._id,
            content: data.message.content,
            sender: data.message.sender || {
              _id: data.message.originalSenderId || 'unknown',
              name: 'Unknown Sender'
            },
            timestamp: data.message.timestamp,
            read: data.message.read || false,
            uniqueMessageKey: messageKey
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
  }, [chatId, scrollToBottom]);

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

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      const reader = new FileReader();
      const filePromise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
      });

      reader.readAsDataURL(file);
      const base64Data = await filePromise;

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/upload`,
        { 
          file: base64Data,
          fileName: file.name 
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
      return null;
    }
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
          type: attachment.type,
          name: attachment.name
        };
      }

      const messageContent = content.trim();
      const timestamp = new Date().toISOString();
      const messageKey = `${messageContent}-${timestamp}-${user._id}`;

      // Optimistically add the message to the UI
      const optimisticMessage: Message = {
        _id: `temp-${Date.now()}`,
        content: messageContent,
        sender: {
          _id: user._id,
          name: user.name
        },
        timestamp: timestamp,
        read: false,
        uniqueMessageKey: messageKey,
        attachment: attachmentData
      };

      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      scrollToBottom();

      // Send the message through socket
      socketRef.current?.emit('sendMessage', {
        chatId,
        content: messageContent,
        uniqueMessageKey: messageKey,
        attachment: attachmentData
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
  }, [chatId, user, scrollToBottom]);

  // Fetch chat data
  const fetchChatData = useCallback(async () => {
    if (!chatId || !user) {
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      setLoading(true);
      setError(null);

      const response = await axios.get(`${import.meta.env.VITE_API_URL}/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setChatData(response.data);
      setMessages(response.data.messages || []);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching chat data:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        navigate('/login');
      } else {
        setError('Failed to load chat details. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [chatId, user, navigate, scrollToBottom]);

  // Initial fetch
  useEffect(() => {
    if (authLoading) return;
    
    fetchChatData();
  }, [authLoading, fetchChatData]);

  // Memoize other participant to prevent unnecessary re-renders
  const otherParticipant = useMemo(() => 
    chatData?.participants.find(p => p._id !== user?._id), 
    [chatData, user]
  );

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
            onClick={fetchChatData} 
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
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center bg-white dark:bg-gray-800 shadow-sm">
        <div className={`flex-shrink-0 h-10 w-10 rounded-full ${otherParticipant ? getAvatarColor(otherParticipant.name) : 'bg-gray-400'} flex items-center justify-center text-white font-semibold`}>
          {otherParticipant ? getInitials(otherParticipant.name) : '?'}
        </div>
        <div className="ml-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {otherParticipant?.name || 'Unknown User'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {otherParticipant?.email || ''}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-4">
        {Object.entries(groupedMessages).map(([date, messages]) => (
          <div key={date} className="mb-6">
            {/* Date Header */}
            <div className="text-center mb-4">
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-500 dark:text-gray-400">
                {isSameDay(new Date(date), new Date()) 
                  ? 'Today' 
                  : format(new Date(date), 'MMMM d, yyyy')}
              </span>
            </div>

            {/* Messages for this date */}
            <div className="space-y-4">
              {messages.map((message, index) => {
                // Safety check for message and sender
                if (!message || !message.sender) {
                  console.warn('Invalid message object:', message);
                  return null;
                }

                const isCurrentUserMessage = message.sender._id === user?._id;
                const isPreviousMessageSameSender = index > 0 && 
                  messages[index - 1]?.sender?._id === message.sender._id;
                const isNextMessageSameSender = index < messages.length - 1 && 
                  messages[index + 1]?.sender?._id === message.sender._id;

                return (
                  <div 
                    key={message._id} 
                    className={`flex ${isCurrentUserMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-end max-w-[80%] ${isCurrentUserMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      {!isCurrentUserMessage && !isNextMessageSameSender && (
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full ${getAvatarColor(message.sender.name)} flex items-center justify-center text-white text-xs ${isCurrentUserMessage ? 'ml-2' : 'mr-2'}`}>
                          {getInitials(message.sender.name)}
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className={`space-y-1 ${!isCurrentUserMessage && !isNextMessageSameSender ? 'ml-2' : ''}`}>
                        {/* Sender Name */}
                        {!isCurrentUserMessage && !isPreviousMessageSameSender && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            {message.sender.name}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div 
                          className={`
                            px-3 py-2 rounded-2xl max-w-full break-words
                            ${isCurrentUserMessage 
                              ? 'bg-blue-500 text-white rounded-br-none' 
                              : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-bl-none'}
                            ${!isPreviousMessageSameSender ? 'mt-2' : ''}
                            ${!isNextMessageSameSender ? 'mb-2' : ''}
                          `}
                        >
                          {/* Attachment */}
                          {message.attachment && (
                            <div className="mb-2">
                              {message.attachment.url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                <img 
                                  src={message.attachment.url} 
                                  alt="Attachment" 
                                  className="max-w-full rounded-lg"
                                />
                              ) : (
                                <a 
                                  href={message.attachment.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-200 hover:text-blue-100"
                                >
                                  View Attachment
                                </a>
                              )}
                            </div>
                          )}

                          {/* Message Text */}
                          <p>{message.content || 'Empty message'}</p>
                          
                          {/* Message Status */}
                          <div className="flex items-center justify-end space-x-1 mt-1">
                            <small className={`text-xs ${
                              isCurrentUserMessage 
                                ? 'text-blue-200' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                            </small>
                            {isCurrentUserMessage && (
                              <span className="text-xs">
                                {message.read ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
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

      {/* Message Input */}
      <MessageInput 
        chatId={chatId || ''} 
        onSendMessage={sendMessage}
        socket={socketRef.current}
      />
    </div>
  );
};

export default ChatDetail;
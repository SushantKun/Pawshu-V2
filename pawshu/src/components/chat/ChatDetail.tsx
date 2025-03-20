import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

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
      } 
    }, isSenderMessage: boolean = false) => {
      // Validate incoming message data
      if (!data || !data.message) {
        console.warn('Received invalid message data:', data);
        return;
      }

      // Only update if the message is for the current chat
      if (data.chatId === chatId) {
        setMessages(prevMessages => {
          // Prevent duplicate messages using unique message key
          const isDuplicate = prevMessages.some(msg => 
            msg.uniqueMessageKey === data.message.uniqueMessageKey
          );

          // Check against processed message keys
          if (isDuplicate || processedMessageKeys.has(data.message.uniqueMessageKey || '')) {
            console.warn('Duplicate message prevented:', data.message);
            return prevMessages;
          }

          // Update processed message keys
          setProcessedMessageKeys(prev => {
            const newSet = new Set(prev);
            newSet.add(data.message.uniqueMessageKey || '');
            
            // Limit set size to prevent memory growth
            if (newSet.size > 100) {
              const oldestKey = Array.from(newSet)[0];
              newSet.delete(oldestKey);
            }
            
            return newSet;
          });

          // Prepare the new message
          const newMessage: Message & { clientMessageId?: string } = {
            _id: data.message._id,
            content: data.message.content,
            sender: {
              _id: isSenderMessage 
                ? (user?._id || 'unknown') 
                : (data.message.sender?._id || data.message.originalSenderId || 'unknown'),
              name: isSenderMessage 
                ? (user?.name || 'Me') 
                : (data.message.sender?.name || 'Unknown Sender')
            },
            timestamp: data.message.timestamp,
            read: data.message.read || false,
            uniqueMessageKey: data.message.uniqueMessageKey,
            isSenderMessage: isSenderMessage,
            originalSenderId: data.message.originalSenderId
          };

          // Add the new message to the existing messages
          return [...prevMessages, newMessage];
        });
        scrollToBottom();
      }
    };

    // Handle messages sent to other users in the chat
    const handleNewMessage = (data: { 
      chatId: string; 
      message: Message & { 
        isSenderMessage?: boolean; 
        originalSenderId?: string;
        clientMessageId?: string;
      } 
    }) => handleIncomingMessage(data, false);

    // Handle messages sent by the current user
    const handleMessageSent = (data: { 
      chatId: string; 
      message: Message & { 
        isSenderMessage?: boolean; 
        originalSenderId?: string;
        clientMessageId?: string;
      } 
    }) => handleIncomingMessage(data, true);

    // Register event listeners
    currentSocket.on('newMessage', handleNewMessage);
    currentSocket.on('messageSent', handleMessageSent);

    return () => {
      currentSocket.off('newMessage', handleNewMessage);
      currentSocket.off('messageSent', handleMessageSent);
    };
  }, [chatId, scrollToBottom, user, processedMessageKeys]);

  // Send message function
  const sendMessage = useCallback(() => {
    const currentSocket = socketRef.current;
    if (!newMessage.trim() || !currentSocket || !chatId) return;

    try {
      // Optimistically add the message to the UI
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message & { clientMessageId?: string } = {
        _id: tempId,
        content: newMessage.trim(),
        sender: {
          _id: user?._id || 'unknown',
          name: user?.name || 'Me'
        },
        timestamp: new Date().toISOString(),
        read: false,
        uniqueMessageKey: tempId,
        isSenderMessage: true,
        originalSenderId: user?._id
      };

      // Immediately update the messages state
      setMessages(prevMessages => {
        // Prevent adding duplicate optimistic messages
        const isDuplicate = prevMessages.some(msg => 
          msg.content === optimisticMessage.content && 
          msg.sender._id === optimisticMessage.sender._id
        );

        if (isDuplicate) return prevMessages;
        return [...prevMessages, optimisticMessage];
      });
      scrollToBottom();

      // Emit the message
      currentSocket.emit('sendMessage', {
        chatId,
        content: newMessage.trim()
      }, (response: { 
        success: boolean; 
        messageId?: string; 
        uniqueMessageKey?: string; 
        error?: string 
      }) => {
        if (!response.success) {
          console.error('Message send error:', response.error);
          
          // Remove the optimistic message if send fails
          setMessages(prevMessages => 
            prevMessages.filter(msg => msg._id !== tempId)
          );
          
          setError(response.error || 'Failed to send message');
        } else {
          // Update the temporary ID with the server-generated ID
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg._id === tempId 
                ? { 
                    ...msg, 
                    _id: response.messageId || msg._id,
                    uniqueMessageKey: response.uniqueMessageKey
                  } 
                : msg
            )
          );
        }
      });

      // Clear input
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  }, [chatId, newMessage, user, scrollToBottom]);

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
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
          {otherParticipant?.name.charAt(0).toUpperCase()}
        </div>
        <div className="ml-3">
          <h2 className="text-lg font-semibold">{otherParticipant?.name}</h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-4 space-y-2">
        {messages.map((message, index) => {
          // Safety checks for message properties
          if (!message || !message._id) {
            console.warn('Invalid message object:', message);
            return null;
          }

          // Handle null sender
          const senderId = message.sender?._id || 'unknown';
          
          // Determine if this message is from the current user
          const isCurrentUserMessage = senderId === user?._id;

          // Check if the previous message is from the same sender
          const isPreviousMessageSameSender = index > 0 && 
            messages[index - 1].sender?._id === senderId;

          // Check if the next message is from the same sender
          const isNextMessageSameSender = index < messages.length - 1 && 
            messages[index + 1].sender?._id === senderId;

          return (
            <div 
              key={message._id} 
              className={`flex ${isCurrentUserMessage ? 'justify-end' : 'justify-start'} w-full`}
            >
              <div className={`flex items-end max-w-[80%] ${isCurrentUserMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar for receiver's last message in a group */}
                {!isCurrentUserMessage && !isNextMessageSameSender && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs mr-2">
                    {message.sender?.name.charAt(0).toUpperCase() || '?'}
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
                  {/* Message Content */}
                  <p>{message.content || 'Empty message'}</p>
                  
                  {/* Timestamp */}
                  <small className={`text-xs block mt-1 ${
                    isCurrentUserMessage 
                      ? 'text-blue-200' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {message.timestamp 
                      ? formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }) 
                      : 'Unknown time'}
                  </small>
                </div>
              </div>
            </div>
          );
        }).filter(Boolean)}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..." 
          className="flex-grow p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button 
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatDetail;
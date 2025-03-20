import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { io, Socket } from 'socket.io-client';

interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
  };
  content: string;
  timestamp: string;
  read: boolean;
}

interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  messages: Message[];
  lastMessage?: {
    content: string;
    sender: string;
    timestamp: string;
  };
}

const MessagePreview: React.FC<{ 
  message: Message, 
  currentUserId: string 
}> = ({ message, currentUserId }) => {
  // Handle potential null sender
  const senderId = message.sender?._id || 'unknown';
  const senderName = message.sender?.name || 'Unknown Sender';

  return (
    <div 
      className={`flex ${senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
    >
      <div 
        className={`max-w-[70%] p-2 rounded-lg ${
          senderId === currentUserId 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <div className="flex items-center space-x-2">
          {message.sender && (
            <span className="text-xs opacity-70">{senderName}</span>
          )}
          <p>{message.content || 'No message'}</p>
        </div>
        <small className="text-xs opacity-70 block mt-1">
          {message.timestamp 
            ? formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }) 
            : 'Unknown time'}
        </small>
      </div>
    </div>
  );
};

const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const isMountedRef = useRef(true);
  const lastFetchTimeRef = useRef(0);

  const connectSocket = useCallback(() => {
    if (!user) return null;

    const token = localStorage.getItem('token');
    if (!token) return null;

    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Socket connected in ChatList');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setError('Connection error. Please try again.');
    });

    return newSocket;
  }, [user]);

  const fetchChats = useCallback(async () => {
    // Prevent multiple simultaneous fetches or too frequent fetches
    const now = Date.now();
    if (!user || loading || (now - lastFetchTimeRef.current < 5000)) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get(`${import.meta.env.VITE_API_URL}/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (isMountedRef.current) {
        setChats(response.data);
        
        // Update unread counts
        const counts: Record<string, number> = {};
        response.data.forEach((chat: Chat) => {
          counts[chat._id] = chat.messages.filter(msg => 
            msg.sender._id !== user._id && !msg.read
          ).length;
        });
        
        setUnreadCounts(counts);
        setError(null);
        lastFetchTimeRef.current = now;
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        navigate('/login');
      } else {
        setError('Failed to load conversations');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user, navigate]);

  // Connect socket
  useEffect(() => {
    if (authLoading) return;

    const newSocket = connectSocket();
    if (newSocket) {
      setSocket(newSocket);
      return () => {
        newSocket.disconnect();
      };
    }
  }, [authLoading, connectSocket]);

  // Listen for new messages
  useEffect(() => {
    if (!socket || !user) return;

    const handleNewMessage = ({ chatId, message }: { 
      chatId: string, 
      message: Message 
    }) => {
      // Validate incoming message data
      if (!chatId || !message) {
        console.warn('Invalid message data:', { chatId, message });
        return;
      }

      setChats(prevChats => 
        prevChats.map(chat => {
          // Ensure chat exists and matches the message's chat ID
          if (chat._id === chatId) {
            // Handle potential null sender
            const senderId = message.sender?._id || 'unknown';
            
            // Only increment unread count if the message is not from the current user
            if (senderId !== user._id) {
              setUnreadCounts(prev => ({
                ...prev,
                [chatId]: (prev[chatId] || 0) + 1
              }));
            }
            
            // Create a new chat object with updated messages and last message
            return {
              ...chat,
              messages: [...chat.messages, message],
              lastMessage: {
                content: message.content || 'No message',
                sender: senderId,
                timestamp: message.timestamp
              }
            } as Chat;
          }
          return chat;
        })
      );
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, user]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    isMountedRef.current = true;

    if (authLoading) return;
    
    fetchChats();
    const intervalId = setInterval(fetchChats, 30000); // Increased interval to 30 seconds
    
    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [authLoading, fetchChats]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchChats}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {chats.length === 0 ? (
        <p className="text-center text-gray-500">No conversations yet</p>
      ) : (
        chats.map((chat) => {
          const otherParticipant = chat.participants.find(p => p._id !== user._id);
          const lastMessage = chat.messages[chat.messages.length - 1];

          return (
            <Link 
              key={chat._id} 
              to={`/chat/${chat._id}`} 
              className="block hover:bg-gray-100 dark:hover:bg-gray-800 p-4 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                    {otherParticipant?.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">{otherParticipant?.name}</h3>
                    {lastMessage && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                        <MessagePreview 
                          message={lastMessage} 
                          currentUserId={user._id} 
                        />
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  {lastMessage && (
                    <small className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(lastMessage.timestamp), { addSuffix: true })}
                    </small>
                  )}
                  {unreadCounts[chat._id] > 0 && (
                    <span className="ml-2 mt-1 px-2 py-1 bg-blue-500 text-white rounded-full text-xs">
                      {unreadCounts[chat._id]}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
};

export default ChatList;
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
    avatar?: {
      url: string;
      public_id: string;
    };
  };
  content: string;
  timestamp: string;
  read: boolean;
  status?: 'sent' | 'delivered' | 'read';
}

interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    name: string;
    email: string;
    avatar?: {
      url: string;
      public_id: string;
    };
  }>;
  messages: Message[];
  lastMessage?: {
    content: string;
    sender: string;
    timestamp: string;
  };
}

interface ChatListProps {
  setChatId?: (chatId: string) => void;
}

const MessagePreview: React.FC<{ 
  message: Message, 
  currentUserId: string 
}> = ({ message, currentUserId }) => {
  if (!message.sender) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">Message</div>;
  }
  
  const isCurrentUser = message.sender._id === currentUserId;

  return (
    <div className="text-sm text-gray-600 dark:text-gray-400">
      {isCurrentUser ? 'You: ' : ''}{message.content || 'No message'}
    </div>
  );
};

const ChatList: React.FC<ChatListProps> = ({ setChatId }) => {
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
            msg.sender && 
            msg.sender._id !== user._id && 
            !msg.read
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

    // Add handler for when messages are read
    const handleMessageRead = ({ chatId, readBy }: { chatId: string, readBy: string }) => {
      // If current user read the messages, update the unread count for this chat
      if (readBy === user._id) {
        setUnreadCounts(prev => ({
          ...prev,
          [chatId]: 0
        }));
        
        // Also update the messages array to mark all as read
        setChats(prevChats => 
          prevChats.map(chat => {
            if (chat._id === chatId) {
              return {
                ...chat,
                messages: chat.messages.map(msg => 
                  msg.sender && msg.sender._id !== user._id
                    ? { ...msg, read: true }
                    : msg
                )
              } as Chat;
            }
            return chat;
          })
        );
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messagesRead', handleMessageRead);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messagesRead', handleMessageRead);
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

  // Add an effect to handle chat selection from parent component
  useEffect(() => {
    if (setChatId) {
      // This ensures the component is ready to handle chat selection
      console.log('ChatList ready to handle chat selection');
    }
  }, [setChatId]);

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
    <div className="flex flex-col h-full bg-gray-800 text-white">
      {/* Chat List Header */}
      <div className="py-3 px-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
        <h2 className="text-base font-semibold text-white">Conversations</h2>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-b-transparent border-white"></div>
        </div>
      ) : error ? (
        <div className="flex-1 p-4 text-center text-red-400">
          <p>{error}</p>
          <button 
            onClick={fetchChats} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : chats.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center p-4">
            <svg className="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No conversations yet</p>
          </div>
        </div>
      ) : (
        <div className="flex-grow overflow-y-auto px-2 py-2">
          {chats.map((chat) => {
            const otherParticipant = chat.participants.find(p => p._id !== user._id);
            const lastMessage = chat.messages[chat.messages.length - 1];

            return (
              <div 
                key={chat._id} 
                onClick={() => {
                  if (setChatId) {
                    console.log('Setting chat ID in ChatList:', chat._id);
                    // Clear unread count immediately when selecting this chat
                    setUnreadCounts(prev => ({
                      ...prev,
                      [chat._id]: 0
                    }));
                    
                    // Emit socket event to mark messages as read
                    if (socket) {
                      socket.emit('readMessages', { 
                        chatId: chat._id,
                        readBy: user._id  
                      });
                      
                      // Also mark messages as read locally
                      setChats(prevChats => 
                        prevChats.map(c => {
                          if (c._id === chat._id) {
                            return {
                              ...c,
                              messages: c.messages.map(msg => 
                                msg.sender && msg.sender._id !== user._id
                                  ? { ...msg, read: true }
                                  : msg
                              )
                            };
                          }
                          return c;
                        })
                      );
                    }
                    
                    setTimeout(() => {
                      setChatId(chat._id);
                    }, 10);
                  } else {
                    navigate(`/chat/${chat._id}`);
                  }
                }}
                className="block hover:bg-gray-700 p-3 rounded-lg transition-colors mb-1 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
                      otherParticipant?.avatar?.url ? '' : 'bg-indigo-600 text-white font-semibold'
                    }`}>
                      {otherParticipant?.avatar?.url ? (
                        <img 
                          src={otherParticipant.avatar.url} 
                          alt={otherParticipant.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Avatar failed to load:', otherParticipant.name);
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.parentElement) {
                              e.currentTarget.parentElement.innerHTML = otherParticipant.name.charAt(0).toUpperCase();
                            }
                          }}
                        />
                      ) : (
                        otherParticipant?.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {otherParticipant?.name}
                      </h3>
                      {lastMessage && (
                        <div className="flex items-center space-x-2">
                          <MessagePreview 
                            message={lastMessage} 
                            currentUserId={user._id} 
                          />
                          <span className="text-xs text-gray-400">
                            · {formatDistanceToNow(new Date(lastMessage.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Display message status based on whether there are unread messages or not */}
                  {(() => {
                    // If there are unread messages from the OTHER user, show a small status indicator
                    const unreadCount = unreadCounts[chat._id] || 0;
                    
                    if (unreadCount > 0) {
                      // For multiple unread messages, show the count
                      return (
                        <div className="flex-shrink-0 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" title={`${unreadCount} unread messages`}>
                          {unreadCount}
                        </div>
                      );
                    }
                    
                    // Otherwise show status of the last message from the current user
                    const lastOwnMessage = [...chat.messages]
                      .reverse()
                      .find(msg => msg.sender && msg.sender._id === user._id);
                      
                    if (lastOwnMessage) {
                      if (lastOwnMessage.status === 'read') {
                        return (
                          <div className="flex items-center" title="Read">
                            <div className="relative h-4 w-6">
                              {/* First checkmark */}
                              <svg className="absolute left-0 h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {/* Second checkmark */}
                              <svg className="absolute left-2 h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        );
                      } else if (lastOwnMessage.status === 'delivered') {
                        return (
                          <div className="flex items-center" title="Delivered">
                            <div className="relative h-4 w-6">
                              {/* First checkmark */}
                              <svg className="absolute left-0 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {/* Second checkmark */}
                              <svg className="absolute left-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="flex items-center" title="Sent">
                            {/* Single checkmark */}
                            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        );
                      }
                    }
                    
                    // Default case - no status indicator needed
                    return null;
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChatList;
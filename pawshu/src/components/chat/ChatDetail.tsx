import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';
import { io, Socket } from 'socket.io-client';

interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    email: string;
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
  context: {
    type: 'lost-found' | 'appointment';
    referenceId: string;
  };
}

const ChatDetail = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to Socket.io server
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setError('Failed to establish real-time connection');
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [user]);

  // Listen for new messages
  useEffect(() => {
    if (!socket || !chatId) return;

    socket.on('newMessage', (data: { chatId: string; message: Message }) => {
      if (data.chatId === chatId) {
        setChat(prevChat => {
          if (!prevChat) return null;
          return {
            ...prevChat,
            messages: [...prevChat.messages, data.message]
          };
        });
      }
    });

    // Join the chat room
    socket.emit('joinRoom', { chatId });

    return () => {
      socket.off('newMessage');
      socket.emit('leaveRoom', { chatId });
    };
  }, [socket, chatId]);

  // Fetch chat details
  useEffect(() => {
    const fetchChat = async () => {
      if (!user || !chatId) return;

      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:5000/api/chats/${chatId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.data) {
          setChat(response.data);
          setError(null);
        } else {
          setError('Conversation not found or no longer available');
        }
        
        setLoading(false);
      } catch (error: any) {
        console.error('Error fetching chat:', error);
        setError(error.response?.data?.message || 'Failed to load conversation');
        setLoading(false);
      }
    };

    fetchChat();
  }, [user, chatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages]);

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket || !chatId) return;

    try {
      // Send via socket for real-time update
      socket.emit('sendMessage', {
        chatId,
        content: message
      });

      // Also send via REST API as a fallback
      await axios.post(`http://localhost:5000/api/chats/${chatId}/messages`, 
        { content: message },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  };

  // Format timestamp to relative time
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.round(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return format(date, 'MMM d, yyyy');
  };

  // Get the other participant in the chat
  const getOtherParticipant = (chat: Chat) => {
    if (!user || !chat) return { name: 'Unknown' };
    return chat.participants.find(p => p._id !== user._id) || { name: 'Unknown' };
  };

  const getContextLabel = () => {
    if (!chat) return '';
    return chat.context.type === 'lost-found' 
      ? `Regarding ${chat.context.type.replace('-', ' ')} pet` 
      : 'Appointment';
  };

  if (loading) return (
    <div className="p-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading conversation...</p>
    </div>
  );
  
  if (error) return (
    <div className="p-8 text-center">
      <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-lg inline-block mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
      <button 
        onClick={() => navigate('/chat')}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Go to Conversations
      </button>
    </div>
  );
  
  if (!chat) return (
    <div className="p-8 text-center">
      <div className="bg-yellow-100 dark:bg-yellow-900/20 p-4 rounded-lg inline-block mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Conversation Not Found</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        This conversation may no longer exist or you don't have access to it.
      </p>
      <button 
        onClick={() => navigate('/chat')}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Go to Conversations
      </button>
    </div>
  );

  const otherParticipant = getOtherParticipant(chat);
  const contextLabel = getContextLabel();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
            {otherParticipant.name?.charAt(0)}
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {otherParticipant.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {contextLabel}
            </p>
          </div>
        </div>
        <Link to="/chat" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4" ref={messagesEndRef}>
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : chat ? (
          <div className="space-y-4">
            {chat.messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                No messages yet. Start the conversation!
              </div>
            ) : (
              <>
                {chat.messages.map((message, index) => {
                  const isSentByMe = message.sender._id === user?._id;
                  return (
                    <div 
                      key={index} 
                      className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[75%] px-4 py-2 rounded-lg ${
                          isSentByMe 
                            ? 'bg-blue-500 text-white rounded-br-none' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
                        }`}
                      >
                        <p>{message.content}</p>
                        <div 
                          className={`text-xs mt-1 ${
                            isSentByMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {formatTimestamp(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400 text-center">
              Conversation not found. <Link to="/chat" className="text-blue-500 hover:underline">Go back to chat list</Link>
            </p>
          </div>
        )}
      </div>

      {chat && (
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex space-x-2">
            <input
              type="text"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!message.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ChatDetail; 
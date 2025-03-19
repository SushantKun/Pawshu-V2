import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

  // Format timestamp to readable time
  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  // Get the other participant in the chat
  const getOtherParticipant = () => {
    if (!chat || !user) return { name: 'Unknown' };
    return chat.participants.find(p => p._id !== user._id) || { name: 'Unknown' };
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

  const otherParticipant = getOtherParticipant();

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-800">
      {/* Chat header */}
      <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <button 
          onClick={() => navigate('/chat')}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 mr-2"
        >
          <span className="text-gray-500">←</span>
        </button>
        <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
          {otherParticipant.name?.charAt(0) || '?'}
        </div>
        <div className="ml-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {otherParticipant.name}
          </h2>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {chat.messages.map((msg) => {
          const isCurrentUser = msg.sender._id === user?._id;
          return (
            <div 
              key={msg._id} 
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  isCurrentUser 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <div className="text-sm">{msg.content}</div>
                <div className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-100' : 'text-gray-500'}`}>
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-l-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-r-lg px-4 py-2 disabled:opacity-50"
          >
            <span>→</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatDetail; 
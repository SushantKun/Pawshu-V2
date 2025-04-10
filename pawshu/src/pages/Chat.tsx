import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaPaperPlane, FaArrowLeft } from 'react-icons/fa';
import io from 'socket.io-client';

interface Message {
  _id: string;
  sender: string;
  content: string;
  timestamp: Date;
}

interface ChatState {
  recipientId: string;
  recipientName: string;
  reportId: string;
  reportType: 'lost' | 'found';
  petType: string;
}

const Chat = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get chat state from location
  const chatState = location.state as ChatState;
  
  useEffect(() => {
    if (!user) {
      toast.error('Please log in to access chat');
      navigate('/login');
      return;
    }
    
    if (!chatId || !chatState) {
      toast.error('Invalid chat');
      navigate('/lost-found');
      return;
    }
    
    // Initialize socket connection
    const newSocket = io('http://localhost:5000', {
      auth: {
        token: localStorage.getItem('token')
      }
    });
    
    setSocket(newSocket);
    
    // Join the chat room
    newSocket.emit('join_chat', { chatId });
    
    // Listen for incoming messages
    newSocket.on('receive_message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });
    
    // Fetch existing messages
    const fetchMessages = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/chats/${chatId}/messages`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }
        
        const data = await response.json();
        setMessages(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
        setLoading(false);
      }
    };
    
    fetchMessages();
    
    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [chatId, user, navigate, chatState]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket) return;
    
    // Emit the message to the server
    socket.emit('send_message', {
      chatId,
      content: newMessage,
      sender: user?._id
    });
    
    // Clear the input field
    setNewMessage('');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-md p-4 flex items-center">
        <button 
          onClick={() => navigate('/lost-found')}
          className="mr-4 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
        >
          <FaArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
            Chat with {chatState.recipientName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {chatState.reportType === 'lost' ? 'Lost' : 'Found'} {chatState.petType}
          </p>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message._id} 
                className={`flex ${message.sender === user?._id ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-xs md:max-w-md p-3 rounded-lg ${
                    message.sender === user?._id 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                  }`}
                >
                  <p>{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="bg-white dark:bg-gray-800 p-4 shadow-md">
        <div className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-blue-500 text-white p-2 rounded-r-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <FaPaperPlane size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
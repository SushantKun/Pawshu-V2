import React, { useState, useEffect, useRef } from 'react';
import { FaComment, FaTimesCircle, FaPaperPlane } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// Create a configured axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add auth token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Store the current user's ID in localStorage
const storeCurrentUserId = (id: string) => {
  localStorage.setItem('current-chat-user-id', id);
};

interface Message {
  _id?: string;
  id?: string;
  sender: string;
  content: string;
  timestamp: Date;
  chatId?: string;
  isSentByMe: boolean;
}

interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
  lastMessage?: Date;
}

// Create a global state for active chat
let globalActiveChat: string | null = null;
let globalSetActiveChat: ((chatId: string | null) => void) | null = null;

const ChatButton: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeChatData, setActiveChatData] = useState<{
    recipientName: string;
    recipientId: string;
    reportDetails?: {
      reportId: string;
      reportType: 'lost' | 'found';
      petType: string;
    }
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // When user is available, store their ID in localStorage for later comparison
  useEffect(() => {
    if (user?._id) {
      storeCurrentUserId(user._id);
    }
  }, [user]);

  // Assign to global variables
  useEffect(() => {
    globalSetActiveChat = setActiveChat;
    if (activeChat) {
      globalActiveChat = activeChat;
    }
  }, [activeChat]);

  // Load chats on first render
  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user]);

  // Fetch all user chats
  const fetchChats = async () => {
    try {
      setLoading(true);
      console.log('Fetching all chats for user');
      const response = await api.get('/api/chats');
      console.log('Received chats:', response.data);
      setChats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching chats:', error);
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Connect to socket when component mounts
  useEffect(() => {
    if (!user) return;

    // Initialize socket connection
    const newSocket = io('http://localhost:5000', {
      auth: {
        token: localStorage.getItem('token')
      }
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to socket server with ID:', newSocket.id);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });
    
    // Listen for incoming messages globally
    newSocket.on('receive_message', (message: any) => {
      console.log('Received message through socket:', message);
      
      // Format the message to match our Message interface
      const formattedMessage: Message = {
        _id: message._id || message.id || Date.now().toString(),
        sender: message.sender,
        content: message.content,
        timestamp: new Date(message.timestamp || Date.now()),
        chatId: message.chatId,
        // Add this flag to ensure correct positioning
        isSentByMe: message.sender === user._id
      };
      
      // Auto-open chat if it's the active chat
      if (message.sender !== user._id) {
        if (activeChat === message.chatId) {
          setMessages(prev => [...prev, formattedMessage]);
        } else {
          // If chat is not active, show a notification
          toast.custom((t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
            >
              <div className="flex-1 w-0 p-4" onClick={() => {
                setActiveChat(message.chatId as string);
                setIsChatOpen(true);
                toast.dismiss(t.id);
              }}>
                <div className="flex items-start">
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      New message
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {message.content.length > 30 
                        ? message.content.substring(0, 30) + '...' 
                        : message.content}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ));
        }
      }
    });
    
    setSocket(newSocket);
    
    // Cleanup on unmount
    return () => {
      console.log('Cleaning up socket connection');
      newSocket.disconnect();
    };
  }, [user, activeChat]);

  // Load messages when activeChat changes
  useEffect(() => {
    if (activeChat && user) {
      fetchMessages(activeChat);
      
      // Join the chat room
      if (socket) {
        console.log('Joining chat room:', activeChat);
        socket.emit('join_chat', { 
          chatId: activeChat,
          userId: user._id
        });
      }
      
      // Get recipient info
      const chat = chats.find(c => c._id === activeChat);
      if (chat) {
        const recipient = chat.participants.find(p => p._id !== user._id);
        if (recipient) {
          setActiveChatData({
            recipientId: recipient._id,
            recipientName: recipient.firstName && recipient.lastName 
              ? `${recipient.firstName} ${recipient.lastName}` 
              : recipient.email?.split('@')[0] || 'User',
            // Report details would be retrieved separately if needed
          });
        }
      }
    }
  }, [activeChat, user, socket, chats]);

  const fetchMessages = async (chatId: string) => {
    try {
      setLoading(true);
      console.log('Fetching messages for chat:', chatId);
      const response = await api.get(`/api/chats/${chatId}/messages`);
      
      if (Array.isArray(response.data)) {
        // Map the messages to our Message interface
        const formattedMessages: Message[] = response.data.map((msg: any) => ({
          _id: msg._id || Date.now().toString(),
          sender: msg.sender, 
          content: msg.content,
          timestamp: new Date(msg.timestamp || Date.now()),
          chatId: chatId, // Add the chatId to each message
          isSentByMe: user ? msg.sender === user._id : false
        }));
        
        console.log('Received messages from API:', formattedMessages.length);
        setMessages(formattedMessages);
      } else {
        console.error('Expected array of messages but got:', response.data);
        setMessages([]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket || !activeChat || !user) return;
    
    console.log('Sending message to chat:', activeChat);
    
    // Emit the message to the server
    socket.emit('send_message', {
      chatId: activeChat,
      content: newMessage,
      sender: user._id,
      timestamp: new Date()
    });
    
    // Add message to local state immediately for better UX
    const tempMessage: Message = {
      _id: Date.now().toString(),
      sender: user._id,
      content: newMessage,
      timestamp: new Date(),
      isSentByMe: true // Always true for messages we send
    };
    
    setMessages(prev => [...prev, tempMessage]);
    
    // Post message to backend
    api.post(`/api/chats/${activeChat}/message`, { content: newMessage })
      .then(response => {
        console.log('Message saved to server:', response.data);
      })
      .catch(error => {
        console.error('Error sending message to server:', error);
        toast.error('Failed to send message');
      });
    
    // Clear the input field
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Public method to start a chat
  const startChat = async (recipientId: string, recipientName: string, reportDetails?: any) => {
    if (!user) {
      toast.error('Please log in to start a chat');
      return;
    }
    
    try {
      // Check if chat already exists
      const existingChat = chats.find(chat => 
        chat.participants.some(p => p._id === recipientId)
      );
      
      if (existingChat) {
        setActiveChat(existingChat._id);
        setActiveChatData({
          recipientId,
          recipientName,
          reportDetails
        });
        setIsChatOpen(true);
        return;
      }
      
      // Create new chat
      const response = await api.post('/api/chats', {
        participantId: recipientId
      });
      
      const newChatId = response.data._id;
      setActiveChat(newChatId);
      setActiveChatData({
        recipientId,
        recipientName,
        reportDetails
      });
      
      // Refresh chats list
      fetchChats();
      
      // Open chat window
      setIsChatOpen(true);
      toast.success('Chat started successfully');
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat. Please try again later.');
    }
  };

  // Make startChat available globally
  (window as any).startChat = startChat;

  return (
    <>
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50 flex items-center justify-center"
        aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
      >
        {isChatOpen ? <FaTimesCircle size={24} /> : <FaComment size={24} />}
      </button>
      
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 z-50 animate-fade-in">
          <div className="w-96 h-[500px] flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700 bg-blue-600 text-white">
              <div className="flex justify-between items-center">
                <div>
                  {activeChat ? (
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold mr-3">
                        {activeChatData?.recipientName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          {activeChatData?.recipientName || 'Chat'}
                        </h2>
                        {activeChatData?.reportDetails && (
                          <p className="text-xs text-blue-100">
                            {activeChatData.reportDetails.reportType === 'lost' ? 'Lost' : 'Found'} {activeChatData.reportDetails.petType}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <h2 className="text-xl font-semibold text-white">Your Chats</h2>
                  )}
                </div>
                {activeChat && (
                  <button 
                    onClick={() => setActiveChat(null)}
                    className="text-white hover:text-blue-200 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Chat List or Messages Area */}
            {!activeChat ? (
              <div className="flex-1 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                      <FaComment className="text-blue-500 dark:text-blue-300" size={24} />
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium mb-2">No conversations yet</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Start a conversation from Lost & Found to connect with pet owners
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {chats.map((chat) => {
                      const recipient = chat.participants.find(p => p._id !== user?._id);
                      const recipientName = recipient 
                        ? (recipient.firstName && recipient.lastName 
                            ? `${recipient.firstName} ${recipient.lastName}` 
                            : recipient.email?.split('@')[0] || 'User')
                        : 'Unknown';
                      
                      return (
                        <div 
                          key={chat._id} 
                          onClick={() => setActiveChat(chat._id)}
                          className="p-3 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md cursor-pointer transition-colors flex items-center"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold mr-3">
                            {recipientName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <p className="font-medium text-gray-800 dark:text-gray-200">{recipientName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {chat.lastMessage ? new Date(chat.lastMessage).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric'
                                }) : ''}
                              </p>
                            </div>
                            {/* We could add last message preview here if available */}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium mb-2">No messages yet</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                      Send a message to start the conversation!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => {
                      // Use the isSentByMe flag directly for consistent positioning
                      const isFromMe = message.isSentByMe;
                      const showDate = index === 0 || 
                        new Date(message.timestamp).toDateString() !== 
                        new Date(messages[index - 1].timestamp).toDateString();
                      
                      return (
                        <React.Fragment key={message._id || message.id}>
                          {showDate && (
                            <div className="flex justify-center my-4">
                              <div className="text-xs py-1 px-3 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400">
                                {new Date(message.timestamp).toLocaleDateString(undefined, {
                                  weekday: 'long',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                            </div>
                          )}
                          <div className={`message ${isFromMe ? 'this-user' : 'other-user'}`}>
                            <div 
                              className={`max-w-[75%] p-3 rounded-lg ${
                                isFromMe
                                  ? 'bg-blue-600 text-white rounded-br-none float-right' 
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none float-left'
                              }`}
                            >
                              <p className="break-words">{message.content}</p>
                              <p className="text-xs mt-1 opacity-70 text-right">
                                {new Date(message.timestamp).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                            <div className="clear-both"></div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
              {activeChat ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                      rows={1}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FaPaperPlane size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Export functions for global use
(window as any).ChatFunctions = {
  setActiveChat: (chatId: string) => {
    if (globalSetActiveChat) {
      globalSetActiveChat(chatId);
    }
  }
};

export { ChatButton };
export default ChatButton;

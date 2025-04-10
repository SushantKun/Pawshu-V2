import React, { useRef, useEffect, useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import axios from 'axios';

// Message interface that matches our backend model
interface Message {
  _id: string;
  sender: string | { _id: string; [key: string]: any };  // Handle both string ID and populated sender object
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

// Constants for local storage keys
const CURRENT_USER_KEY = 'current-chat-user-id';
const MESSAGES_STORAGE_KEY = 'chat-messages';

const ChatInterface: React.FC<{ chatId?: string, recipientName?: string }> = ({ 
  chatId, 
  recipientName = 'Sushant Dahal'
}) => {
  const { user } = useAuth();
  const { messages: contextMessages, sendMessage: sendContextMessage, activeChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Store user ID in localStorage for consistent reference
  useEffect(() => {
    if (user?._id) {
      localStorage.setItem(CURRENT_USER_KEY, user._id);
    }
  }, [user]);
  
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

  // Fetch messages from API directly
  useEffect(() => {
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
        } else {
          // Demo messages as fallback
          setMessages([
            {
              _id: '1',
              sender: 'other-user-id', // This will show on the left
              content: "hi",
              timestamp: new Date('2023-04-10T03:58:00'),
              status: 'read'
            },
            {
              _id: '2',
              sender: user._id, // This will show on the right
              content: "hello",
              timestamp: new Date('2023-04-10T03:58:00'),
              status: 'sent'
            }
          ]);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        // Fallback to empty messages list
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [user, chatId, activeChat, contextMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Store messages in localStorage to maintain positions during refreshes
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    
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

  // Get recipient initial for the avatar
  const getRecipientInitial = () => {
    return recipientName.charAt(0).toUpperCase();
  };

  // Debug info for troubleshooting
  useEffect(() => {
    if (messages.length > 0) {
      console.log("Current user ID:", user?._id);
      console.log("Message sample:", messages[0]);
    }
  }, [messages, user]);

  return (
    <div className="w-96 h-[500px] flex flex-col bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-blue-600 flex items-center">
        <div className="mr-3">
          <div className="bg-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold">{getRecipientInitial()}</div>
        </div>
        <div>
          <h2 className="font-semibold text-white">{recipientName}</h2>
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
            {/* Date separator - only show if we have messages */}
            {messages.length > 0 && (
              <div className="flex justify-center my-2">
                <div className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">
                  {formatMessageDate(new Date(messages[0].timestamp))}
                </div>
              </div>
            )}
            
            {/* Messages */}
            {messages.map((message) => {
              // Directly check if the sender is the current user
              const isFromMe = isMessageFromCurrentUser(message.sender);
              
              return (
                <div 
                  key={message._id} 
                  className={isFromMe ? "flex justify-end" : "flex justify-start"}
                >
                  <div 
                    className={
                      isFromMe 
                        ? "max-w-[70%] p-3 rounded-lg bg-blue-500 text-white rounded-br-none" 
                        : "max-w-[70%] p-3 rounded-lg bg-gray-700 text-white rounded-bl-none"
                    }
                  >
                    <p className="break-words">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70 text-right">
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || loading}
            className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPaperPlane size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
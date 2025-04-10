import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaPaperPlane, FaArrowLeft, FaCheck } from 'react-icons/fa';
import io from 'socket.io-client';
import axios from 'axios';

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

// Define the status type
type ReportStatus = 'open' | 'resolved' | 'closed';

const Chat = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<any>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus>('open');
  const [isReportOwner, setIsReportOwner] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get chat state from location
  const chatState = location.state as ChatState;
  
  // Fetch report status
  useEffect(() => {
    if (chatState?.reportId) {
      const fetchReportStatus = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`http://localhost:5000/api/lost-found/${chatState.reportId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data) {
            if (response.data.status) {
              setReportStatus(response.data.status);
            }
            
            // Check if current user is the report owner
            if (response.data.userId && user) {
              setIsReportOwner(response.data.userId._id === user._id);
            }
          }
        } catch (error) {
          console.error('Error fetching report status:', error);
        }
      };
      
      fetchReportStatus();
      
      // Set up interval to refresh status periodically
      const statusInterval = setInterval(fetchReportStatus, 30000); // Check every 30 seconds
      
      return () => clearInterval(statusInterval);
    }
  }, [chatState, user]);
  
  // Function to reopen the report
  const handleReopenReport = async () => {
    if (!chatState?.reportId || !isReportOwner) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.put(
        `http://localhost:5000/api/lost-found/${chatState.reportId}/status`, 
        { status: 'open' },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status === 200) {
        setReportStatus('open');
        toast.success('Report reopened successfully');
        
        // Force the socket connection to refresh the chat status
        if (socket) {
          socket.emit('join_chat', { chatId });
        }
      } else {
        toast.error('Failed to reopen report');
      }
    } catch (error) {
      console.error('Error reopening report:', error);
      toast.error('Failed to reopen report');
    } finally {
      setLoading(false);
    }
  };
  
  // Navigate to the chat with appropriate data
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
    
    // For resolved reports, notify the user once
    if (reportStatus === 'resolved') {
      toast.success('This chat is for a resolved report. Messaging has been disabled.', {
        id: 'resolved-report-notification',
        duration: 5000
      });
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
    
    // Listen for error events
    newSocket.on('error', (error) => {
      toast.error(error.message || 'Error sending message');
    });
    
    // Listen for report status changes
    newSocket.on('report_status_changed', (data: { reportId: string, status: 'open' | 'resolved' | 'closed' }) => {
      console.log('Report status changed:', data);
      
      // If this is our current report, update the status
      if (chatState?.reportId === data.reportId) {
        setReportStatus(data.status);
        
        // If the report was just resolved, show a message
        if (data.status === 'resolved') {
          toast.success('This report has been marked as resolved. Messaging has been disabled.');
        } else if (data.status === 'open' && reportStatus === 'resolved') {
          toast.success('This report has been reopened. You can now send messages.');
        }
      }
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
  }, [chatId, user, navigate, chatState, reportStatus]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Early return if message is empty, socket isn't connected, or report is resolved
    if (!newMessage.trim() || !socket) return;
    
    // Strictly prevent sending messages in resolved reports - double-check status
    if (reportStatus === 'resolved') {
      setNewMessage(''); // Clear the input field 
      toast.error('This report has been resolved. Messages cannot be sent.');
      return;
    }
    
    // Check report status once more through the API to prevent any race conditions
    fetch(`http://localhost:5000/api/lost-found/${chatState.reportId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === 'resolved') {
        setReportStatus('resolved');
        setNewMessage(''); // Clear the input field
        toast.error('This report has been resolved. Messages cannot be sent.');
        return;
      }
      
      // Only send the message if the report is confirmed to be open
      // Emit the message to the server
      socket.emit('send_message', {
        chatId,
        content: newMessage,
        sender: user?._id
      });
      
      // Clear the input field
      setNewMessage('');
    })
    .catch(error => {
      console.error('Error checking report status:', error);
      // Proceed with sending the message as a fallback
      socket.emit('send_message', {
        chatId,
        content: newMessage,
        sender: user?._id
      });
      
      // Clear the input field
      setNewMessage('');
    });
  };
  
  // Effect to forcibly disable the message input when report is resolved
  useEffect(() => {
    // Function to disable the input field
    const disableInputIfResolved = () => {
      if (reportStatus === 'resolved') {
        // Find all input fields and textareas in the chat interface
        const inputFields = document.querySelectorAll('.chat-interface input, .chat-interface textarea');
        const sendButtons = document.querySelectorAll('.chat-interface button[type="submit"]');
        
        // Disable all input fields and buttons
        inputFields.forEach(input => {
          const inputElement = input as HTMLInputElement | HTMLTextAreaElement;
          inputElement.disabled = true;
          inputElement.placeholder = 'Messaging disabled - report resolved';
          // Add a visual indicator
          inputElement.style.backgroundColor = '#4b5563'; // Gray background
          inputElement.style.cursor = 'not-allowed';
        });
        
        // Disable send buttons
        sendButtons.forEach(button => {
          const buttonElement = button as HTMLButtonElement;
          buttonElement.disabled = true;
          buttonElement.style.backgroundColor = '#4b5563'; // Gray background
          buttonElement.style.cursor = 'not-allowed';
        });
      }
    };
    
    // Initial call to disable inputs
    disableInputIfResolved();
    
    // Set up a MutationObserver to watch for DOM changes and keep inputs disabled
    const observer = new MutationObserver(disableInputIfResolved);
    const config = { childList: true, subtree: true };
    
    // Start observing the document for DOM changes
    observer.observe(document.body, config);
    
    // Additional safety - check periodically (every 500ms) to ensure inputs remain disabled
    const intervalCheck = setInterval(disableInputIfResolved, 500);
    
    // Cleanup function
    return () => {
      observer.disconnect();
      clearInterval(intervalCheck);
    };
  }, [reportStatus]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 chat-interface">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-md p-4 flex items-center">
        <button 
          onClick={() => navigate('/lost-found')}
          className="mr-4 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
        >
          <FaArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
              Chat with {chatState.recipientName}
            </h1>
            {reportStatus === 'resolved' && (
              <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
                <FaCheck className="mr-1" size={10} />
                Resolved
              </span>
            )}
          </div>
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
      
      {/* Message Input or Resolved Message */}
      {reportStatus === 'resolved' ? (
        <div className="bg-white dark:bg-gray-800 p-4 shadow-md">
          <div className="bg-green-500 text-white p-4 rounded-md text-center">
            <p className="font-medium">This issue has been resolved. Thank you for your help!</p>
            <p className="text-sm mt-1">Messaging for this report has been disabled.</p>
            
            {/* Option to reopen for report owner */}
            {isReportOwner && (
              <button 
                onClick={handleReopenReport}
                className="mt-3 bg-white text-green-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors"
              >
                Reopen Report
              </button>
            )}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default Chat;
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaComment, FaTimesCircle, FaPaperPlane, FaCheck, FaInfoCircle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import io from 'socket.io-client';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import UserAvatar from '../UserAvatar';
import { useNavigate } from 'react-router-dom';

// Create a configured axios instance
const api = axios.create({
  baseURL: '/api',
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

// Message interface
interface Message {
  _id: string;
  id?: string;
  sender: string | { _id: string;[key: string]: any };
  content: string;
  timestamp: Date;
  chatId?: string;
  status?: 'sent' | 'delivered' | 'read';
}

// Chat interface
interface Chat {
  _id: string;
  participants: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }[];
  lastMessage: Date;
  isActive: boolean;
  reportId?: string;
  reportStatus?: 'open' | 'resolved' | 'closed';
}

interface ReportDetails {
  reportId?: string;
  reportType?: 'lost' | 'found';
  petType?: string;
}

interface ChatData {
  recipientId: string;
  recipientName: string;
  reportDetails?: ReportDetails;
}

// Create a global state for active chat
let globalActiveChat: string | null = null;
let globalSetActiveChat: ((chatId: string | null) => void) | null = null;
let globalSetActiveChatData: ((data: ChatData) => void) | null = null;
let globalSetIsChatOpen: ((isOpen: boolean) => void) | null = null;

// Create a global map to track connected users
let connectedUsers = new Map<string, boolean>();

// Core function to determine if a message is from the current user
// This handles both string IDs and populated sender objects
const isMessageFromCurrentUser = (sender: string | { _id: string;[key: string]: any }, currentUserId?: string): boolean => {
  if (!currentUserId) return false;

  // Handle when sender is a populated object (with _id field)
  if (typeof sender === 'object' && sender !== null && '_id' in sender) {
    return sender._id === currentUserId;
  }

  // Handle when sender is just a string ID
  return sender === currentUserId;
};

// Add a new interface for report owners to check if they can reopen reports
interface ReportOwnership {
  isReportOwner: boolean;
  reportId?: string;
}

const ChatButton: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeChatData, setActiveChatData] = useState<ChatData | null>(null);
  const [reportOwnership, setReportOwnership] = useState<ReportOwnership>({ isReportOwner: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [recipientProfile, setRecipientProfile] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const navigate = useNavigate();
  const [recipientIsOnline, setRecipientIsOnline] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(null);
  const [statusRefreshCounter, setStatusRefreshCounter] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);

  // When user is available, store their ID in localStorage for later comparison
  useEffect(() => {
    if (user?._id) {
      storeCurrentUserId(user._id);
    }
  }, [user]);

  // Assign to global variables
  useEffect(() => {
    globalSetActiveChat = setActiveChat;
    globalSetActiveChatData = setActiveChatData;
    globalSetIsChatOpen = setIsChatOpen;
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
      const response = await api.get('/chats');
      console.log('Received chats:', response.data);
      const enhancedChats = await Promise.all(response.data.map(async (chat: Chat) => {
        if (chat.reportId) {
          try {
            // Ensure we're using the string representation of the reportId
            let reportIdStr: string;

            // Handle the case where reportId might be populated as an object
            if (typeof chat.reportId === 'object' && chat.reportId !== null) {
              // If it's an object with _id property
              reportIdStr = (chat.reportId as any)._id || String(chat.reportId);
            } else {
              // If it's already a string or can be converted to string
              reportIdStr = String(chat.reportId);
            }

            const reportResponse = await api.get(`/lost-found/${reportIdStr}`);
            if (reportResponse.data && reportResponse.data.status) {
              // Only set isActive to false if the report is explicitly resolved
              // For open reports, always ensure isActive is true
              return {
                ...chat,
                reportStatus: reportResponse.data.status,
                isActive: reportResponse.data.status !== 'resolved'
              };
            }
          } catch (error) {
            console.error(`Error fetching report for chat ${chat._id}:`, error);
          }
        }
        // If no reportId or couldn't fetch report, ensure isActive is true by default
        return {
          ...chat,
          isActive: chat.isActive !== false, // Ensure undefined is treated as true
        };
      }));
      setChats(enhancedChats);
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

  // Set up socket connection
  useEffect(() => {
    if (!user) return;

    console.log('Initializing socket connection for user:', user._id);
    const token = localStorage.getItem('token');
    const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';
    
    console.log(`Creating socket connection to: ${socketUrl} with auth token: ${token ? 'present' : 'missing'}`);
    
    // Create socket with more robust configuration
    const newSocket = io(socketUrl, {
      path: '/socket.io',
      auth: {
        token: token
      },
      reconnectionAttempts: 10,     // Try to reconnect 10 times
      reconnectionDelay: 1000,      // Start with a 1 second delay
      reconnectionDelayMax: 10000,  // Maximum 10 seconds between attempts
      timeout: 20000,               // Longer timeout for slow connections
      transports: ['websocket', 'polling']  // Try websocket first, fallback to polling
    });

    // Set up more aggressive keep-alive pings to maintain connection
    const keepAlivePing = setInterval(() => {
      if (newSocket.connected) {
        console.log(`Sending keep-alive ping for user: ${user._id}`);
        newSocket.emit('ping', { userId: user._id });
        
        // Also hit the API endpoint as a backup
        axios.post('/api/auth/ping', { userId: user._id })
          .catch(err => console.error('Error sending API ping:', err));
      } else {
        console.log('Socket disconnected - attempting to reconnect...');
        newSocket.connect();
      }
    }, 15000); // Ping every 15 seconds (more frequent)

    // Add more detailed connection event handlers
    newSocket.on('connect', () => {
      // Socket connected
      console.log('Socket connected successfully:', newSocket.id);
      setSocketConnected(true);
      
      // When connected, ask for a list of all online users
      newSocket.emit('get_online_users');
      
      // Also query user status specifically for current recipient
      if (activeChatData?.recipientId) {
        newSocket.emit('check_user_status', { userId: activeChatData.recipientId });
      }
    });

    newSocket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      
      // Log additional debug info
      console.log('Socket connection state:', {
        connected: newSocket.connected,
        disconnected: newSocket.disconnected,
        clientId: user?._id,
        tokenAvailable: !!token
      });
      
      // Try to reconnect manually after severe connection errors
      if (newSocket.disconnected) {
        setTimeout(() => {
          console.log('Attempting manual socket reconnection...');
          newSocket.connect();
        }, 5000);
      }
    });

    // Handle reconnection events
    newSocket.on('reconnect', (attemptNumber: number) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      
      // Re-join active chat if available
      if (activeChat) {
        newSocket.emit('join_chat', { 
          chatId: activeChat,
          userId: user._id 
        });
      }
      
      // Request updated online users
      newSocket.emit('get_online_users');
    });

    newSocket.on('reconnect_error', (error: Error) => {
      console.error('Socket reconnection error:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after maximum attempts');
    });

    // Add listener for when users connect
    newSocket.on('user_connected', (data: { userId: string }) => {
      console.log('User connected event:', data);
      connectedUsers.set(data.userId, true);
      
      // If this is about our active chat recipient, update their status
      if (activeChatData && data.userId === activeChatData.recipientId) {
        console.log(`Setting recipient ${data.userId} as ONLINE`);
        setRecipientIsOnline(true);
      }
    });
    
    // Add listener for when users disconnect
    newSocket.on('user_disconnected', (data: { userId: string }) => {
      console.log('User disconnected event:', data);
      connectedUsers.set(data.userId, false);
      
      // If this is about our active chat recipient, update their status
      if (activeChatData && data.userId === activeChatData.recipientId) {
        console.log(`Setting recipient ${data.userId} as OFFLINE`);
        setRecipientIsOnline(false);
        setLastOnlineTime(new Date());
      }
    });
    
    // Add listener for list of online users
    newSocket.on('online_users', (data: { users: string[] }) => {
      console.log('Received online users list:', data.users);
      
      // Reset the map
      connectedUsers.clear();
      
      // Add all online users to the map
      data.users.forEach(userId => {
        connectedUsers.set(userId, true);
      });
      
      // Update our recipient's status if needed
      if (activeChatData && activeChatData.recipientId) {
        const isOnline = connectedUsers.has(activeChatData.recipientId);
        console.log(`Setting recipient ${activeChatData.recipientId} as ${isOnline ? 'ONLINE' : 'OFFLINE'} from users list`);
        setRecipientIsOnline(isOnline);
      }
    });

    // Listen for incoming messages globally
    newSocket.on('receive_message', (message: any) => {
      if (!user) return;

      // Format the message to match our Message interface
      const formattedMessage: Message = {
        _id: message._id || message.id || Date.now().toString(),
        sender: message.sender, // Keep sender as is (could be object or ID)
        content: message.content,
        timestamp: new Date(message.timestamp || Date.now()),
        chatId: message.chatId
      };

      // Auto-open chat if it's the active chat
      // Compare using the isMessageFromCurrentUser helper
      if (!isMessageFromCurrentUser(message.sender, user._id)) {
        if (activeChat === message.chatId) {
          setMessages(prev => [...prev, formattedMessage]);
        } else {
          // If chat is not active, show a notification
          toast.custom((t) => (
            <div
              className={`${t.visible ? 'animate-enter' : 'animate-leave'
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

    // Listen for message status updates
    newSocket.on('message_status_updated', (data: { messageId: string, status: string }) => {
      // Update the message status in our local state
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId ? { ...msg, status: data.status as any } : msg
      ));
    });

    // Listen for report status changes to refresh chat data
    newSocket.on('report_status_changed', async (data: { reportId: string, status: 'open' | 'resolved' | 'closed' }) => {
      // Update chat list to reflect new status
      await fetchChats();

      // If this is the current active chat, refresh the resolved status
      if (activeChat) {
        const chat = chats.find(c => c._id === activeChat);
        if (chat && chat.reportId === data.reportId) {
          // Force re-render by updating state
          setChats(prevChats => {
            const updatedChats = prevChats.map(c => {
              if (c.reportId === data.reportId) {
                return {
                  ...c,
                  reportStatus: data.status,
                  isActive: data.status !== 'resolved'
                } as Chat;
              }
              return c;
            });
            return updatedChats;
          });

          // Check if the current user is the report owner (to show reopen button)
          if (data.reportId) {
            checkReportOwnership(data.reportId);
          }

          // If the status changed to resolved, show a message
          if (data.status === 'resolved') {
            toast.error('This report has been marked as resolved. Messaging has been disabled.');
          }
        }
      }
    });

    // Listen for error events
    newSocket.on('error', (error: { message?: string }) => {
      toast.error(error.message || 'An error occurred');
    });

    // Improve typing indicator handling
    newSocket.on('typing', (data: { chatId: string, userId: string }) => {
      if (data.userId !== user?._id && data.chatId === activeChat) {
        setTypingUsers(prev => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      }
    });

    newSocket.on('stop_typing', (data: { chatId: string, userId: string }) => {
      if (data.chatId === activeChat) {
        setTypingUsers(prev => prev.filter(id => id !== data.userId));
      }
    });

    // Handle initial typing users when joining a chat
    newSocket.on('typing_users', (data: { chatId: string, users: string[] }) => {
      if (data.chatId === activeChat) {
        setTypingUsers(data.users.filter(userId => user && userId !== user._id));
      }
    });

    // Handle updated typing users list
    newSocket.on('typing_users_updated', (data: { chatId: string, users: string[] }) => {
      if (data.chatId === activeChat) {
        setTypingUsers(data.users.filter(userId => user && userId !== user._id));
      }
    });

    // Add listener for user status response
    newSocket.on('user_status_response', (data: { userId: string, isOnline: boolean, lastActive?: Date }) => {
      console.log('Received user status response:', data);
      
      // Update our connected users map
      connectedUsers.set(data.userId, data.isOnline);
      
      // If this is about our active chat recipient, update their status
      if (activeChatData && data.userId === activeChatData.recipientId) {
        console.log(`Setting recipient ${data.userId} status to ${data.isOnline ? 'ONLINE' : 'OFFLINE'} from server response`);
        setRecipientIsOnline(data.isOnline);
        
        if (!data.isOnline && data.lastActive) {
          setLastOnlineTime(new Date(data.lastActive));
        }
      }
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();

      // Clean up typing timeouts
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });

      // Clear keep-alive ping
      clearInterval(keepAlivePing);
    };
  }, [user, activeChat, chats]);

  // Load messages when activeChat changes
  useEffect(() => {
    if (activeChat && user) {
      fetchMessages(activeChat);

      // Join the chat room
      if (socket) {
        joinChatRoom(activeChat);
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

        // If chat has a report, check if the current user is the report owner
        if (chat.reportId) {
          checkReportOwnership(chat.reportId);
        } else {
          setReportOwnership({ isReportOwner: false });
        }
      }
    }
  }, [activeChat, user, socket, chats]);

  // Check if the current user is the owner of the report
  const checkReportOwnership = async (reportId: any) => {
    try {
      // Ensure we have a string ID to work with
      let reportIdStr: string;

      // Handle the case where reportId might be an object
      if (typeof reportId === 'object' && reportId !== null) {
        // If it's an object with _id property
        reportIdStr = reportId._id ? reportId._id.toString() : String(reportId);
      } else {
        // If it's already a string or can be converted to string
        reportIdStr = String(reportId);
      }

      const response = await api.get(`/lost-found/${reportIdStr}`);
      if (response.data && response.data.userId && user) {
        setReportOwnership({
          isReportOwner: response.data.userId._id === user._id,
          reportId: reportIdStr
        });
      } else {
        setReportOwnership({ isReportOwner: false });
      }
    } catch (error) {
      console.error('Error checking report ownership:', error);
      setReportOwnership({ isReportOwner: false });
    }
  };

  // Handle reopening the report
  const handleReopenReport = async () => {
    if (!reportOwnership.reportId || !reportOwnership.isReportOwner) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await api.put(
        `/lost-found/${reportOwnership.reportId}/status`,
        { status: 'open' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        toast.success('Report reopened successfully');
        // Refresh chats to get updated status
        fetchChats();
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

  const fetchMessages = async (chatId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/chats/${chatId}/messages`);

      if (Array.isArray(response.data)) {
        // Preserve the original sender data (could be object or string ID)
        // This will ensure we can correctly identify the sender
        const formattedMessages: Message[] = response.data.map((msg: any) => ({
          _id: msg._id || Date.now().toString(),
          sender: msg.sender, // Keep sender as is (object or string ID)
          content: msg.content,
          timestamp: new Date(msg.timestamp || Date.now()),
          chatId: chatId
        }));

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

  // Modify input change handler to emit typing events
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);

    if (activeChat && socket && user) {
      // If user starts typing, emit typing event
      if (e.target.value.trim() !== '') {
        // Emit typing event only if not already typing or if typing timeout has expired
        if (!typingTimeoutRef.current[user._id]) {
          socket.emit('typing', {
            chatId: activeChat,
            userId: user._id
          });
        }

        // Clear any existing timeout for this user
        if (typingTimeoutRef.current[user._id]) {
          clearTimeout(typingTimeoutRef.current[user._id]);
        }

        // Set timeout to stop typing after 3 seconds of inactivity
        typingTimeoutRef.current[user._id] = setTimeout(() => {
          socket.emit('stop_typing', {
            chatId: activeChat,
            userId: user._id
          });

          // Clear the timeout reference after it executes
          delete typingTimeoutRef.current[user._id];
        }, 3000);
      } else {
        // If input is empty, stop typing immediately
        socket.emit('stop_typing', {
          chatId: activeChat,
          userId: user._id
        });

        // Clear any existing timeout
        if (typingTimeoutRef.current[user._id]) {
          clearTimeout(typingTimeoutRef.current[user._id]);
          delete typingTimeoutRef.current[user._id];
        }
      }
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket || !activeChat || !user) return;

    // Check global disabled flag first
    if ((window as any).CHAT_DISABLED_FOR_REPORT === activeChat) {
      toast.error('This report has been resolved. Messages cannot be sent.');
      setNewMessage('');
      return;
    }

    // Check if chat is active (not resolved) from our local state first
    if (isReportResolved()) {
      toast.error('This report has been resolved. Messages cannot be sent.');
      setNewMessage('');
      return;
    }

    // Create the message to send
    const messageContent = newMessage.trim();

    // Add message to local state immediately for better UX
    const tempMessage: Message = {
      _id: Date.now().toString(),
      sender: user._id,
      content: messageContent,
      timestamp: new Date()
    };

    // Clear the input field
    setNewMessage('');

    // Attempt to send via socket
    socket.emit('send_message', {
      chatId: activeChat,
      content: messageContent,
      sender: user._id,
      timestamp: new Date()
    });

    // Optimistically add to local state
    setMessages(prev => [...prev, tempMessage]);

    // Also post to backend API to ensure persistence
    api.post(`/chats/${activeChat}/message`, { content: messageContent })
      .then(response => {
        // Message successfully saved
      })
      .catch(error => {
        console.error('Error sending message to server:', error);

        // Check if this is a resolved report error
        if (error.response?.data?.message?.includes('resolved')) {
          toast.error('This report has been resolved. Messages cannot be sent.');
          // Refresh chat list to get updated statuses
          fetchChats();
        } else {
          toast.error('Failed to send message');
        }

        // Remove the optimistically added message
        setMessages(prev => prev.filter(msg => msg._id !== tempMessage._id));
      });
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
      setLoading(true);

      // If this is a chat related to a report, check if the report is resolved
      if (reportDetails?.reportId) {
        const reportResponse = await api.get(`/lost-found/${reportDetails.reportId}`);
        if (reportResponse.data && reportResponse.data.status === 'resolved') {
          toast.error('This report has been resolved. Messaging has been disabled.');
          setLoading(false);
          return;
        }
      }

      // Check if chat already exists with this participant 
      // and for this specific report if reportId is provided
      const existingChat = chats.find(chat =>
        chat.participants.some(p => p._id === recipientId) &&
        (reportDetails?.reportId ? chat.reportId === reportDetails.reportId : true)
      );

      if (existingChat) {
        // Even if chat exists, double-check if report is resolved
        if (existingChat.reportStatus === 'resolved') {
          toast.error('This report has been resolved. Messaging has been disabled.');
          setLoading(false);
          return;
        }

        // For existing chats with isActive === false, refresh from server to confirm
        if (existingChat.isActive === false) {
          // Refresh the report status first
          await fetchChats();

          // Re-check after refresh
          const refreshedChat = chats.find(c => c._id === existingChat._id);
          if (refreshedChat?.isActive === false || refreshedChat?.reportStatus === 'resolved') {
            toast.error('This report has been resolved. Messaging has been disabled.');
            setLoading(false);
            return;
          }
        }

        // If we got here, chat is valid and active
        setActiveChat(existingChat._id);
        setActiveChatData({
          recipientId,
          recipientName,
          reportDetails
        });
        setIsChatOpen(true);
        setLoading(false);
        return;
      }

      // Create new chat
      console.log('Creating new chat with:', recipientId, reportDetails);
      const response = await api.post('/chats', {
        participantId: recipientId,
        reportId: reportDetails?.reportId
      });

      if (!response.data || response.status >= 400) {
        throw new Error(response.data?.message || 'Failed to create chat');
      }

      const newChatId = response.data._id;
      console.log('New chat created with ID:', newChatId);

      setActiveChat(newChatId);
      setActiveChatData({
        recipientId,
        recipientName,
        reportDetails
      });

      // Refresh chats list
      await fetchChats();

      // Open chat window
      setIsChatOpen(true);
      toast.success('Chat started successfully');
    } catch (error: any) {
      console.error('Error starting chat:', error);

      // More specific error message for resolved reports
      if (error.response?.data?.message?.includes('resolved')) {
        toast.error('This report has been resolved. Messaging has been disabled.');
      } else {
        toast.error('Failed to start chat. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Make startChat available globally
  (window as any).startChat = startChat;

  // Chat status check - enhanced to properly disable messaging for resolved reports
  const isReportResolved = () => {
    if (!activeChat) return false;
    const chat = chats.find(c => c._id === activeChat);
    // First check reportStatus, then fall back to isActive if reportStatus is not available
    if (chat?.reportStatus) {
      return chat.reportStatus === 'resolved';
    }
    // Only return true if isActive is explicitly set to false
    return chat?.isActive === false;
  };

  // Ensure the input is fully disabled when chat is resolved
  useEffect(() => {
    if (activeChat && isReportResolved()) {
      // Force disable any message inputs
      const textareas = document.querySelectorAll('.chat-window textarea');
      const buttons = document.querySelectorAll('.chat-window button');

      textareas.forEach(textarea => {
        const element = textarea as HTMLTextAreaElement;
        element.disabled = true;
        element.value = '';
        element.placeholder = 'Messaging disabled - report resolved';
        element.style.cursor = 'not-allowed';
        element.style.backgroundColor = '#4b5563';
      });

      // Disable send buttons except for ones within the reopen button area
      buttons.forEach(button => {
        if (!button.closest('.reopen-button-area')) {
          const element = button as HTMLButtonElement;
          if (element.getAttribute('role') === 'send') {
            element.disabled = true;
            element.style.cursor = 'not-allowed';
            element.style.backgroundColor = '#4b5563';
          }
        }
      });

      // Set a global flag to prevent any message sending
      (window as any).CHAT_DISABLED_FOR_REPORT = activeChat;
    } else {
      // Clear the flag if not resolved
      (window as any).CHAT_DISABLED_FOR_REPORT = undefined;
    }
  }, [activeChat, chats, isReportResolved]);

  // Add a function to fetch recipient profile information
  const fetchRecipientProfile = async (recipientId: string) => {
    if (!recipientId) return null;

    try {
      // Try the chat/users endpoint first (from our added endpoint)
      const response = await api.get(`/chats/users/${recipientId}`);
      if (response.data) {
        return {
          _id: response.data._id,
          name: response.data.name,
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          email: response.data.email,
          avatar: response.data.avatar
        };
      }
    } catch (error) {
      console.error('Error fetching recipient profile:', error);

      // Check if we have active chat data with recipient name
      if (activeChatData?.recipientName) {
        // Return a basic profile with available information
        const nameArray = activeChatData.recipientName.split(' ');
        return {
          _id: recipientId,
          name: activeChatData.recipientName,
          firstName: nameArray[0] || '',
          lastName: nameArray.slice(1).join(' ') || '',
          email: '',
          avatar: undefined
        };
      }

      // Try to find recipient info from the chat participants
      if (activeChat) {
        const chat = chats.find(c => c._id === activeChat);
        if (chat) {
          const recipient = chat.participants.find(p => p._id === recipientId);
          if (recipient) {
            return {
              _id: recipientId,
              name: recipient.firstName && recipient.lastName
                ? `${recipient.firstName} ${recipient.lastName}`
                : recipient.email?.split('@')[0] || 'User',
              firstName: recipient.firstName || '',
              lastName: recipient.lastName || '',
              email: recipient.email || '',
              avatar: undefined
            };
          }
        }
      }
    }

    // If all else fails, return a generic profile
    return {
      _id: recipientId,
      name: 'User',
      firstName: '',
      lastName: '',
      email: '',
      avatar: undefined
    };
  };

  // Fetch recipient profile when active chat data changes
  useEffect(() => {
    if (activeChatData?.recipientId) {
      fetchRecipientProfile(activeChatData.recipientId)
        .then(profile => {
          if (profile) {
            setRecipientProfile(profile);
          }
        });
    }
  }, [activeChatData]);

  // Debug effect to track typing users state changes
  useEffect(() => {
    if (typingUsers.length > 0) {
      console.log('Typing users state changed:', typingUsers);
    }
  }, [typingUsers]);

  // Function to join a chat room
  const joinChatRoom = (chatId: string) => {
    if (socket && chatId && user) {
      socket.emit('join_chat', {
        chatId,
        userId: user._id
      });
    }
  };

  // Modify checkRecipientStatus to rely exclusively on socket connections instead of API calls
  const checkRecipientStatus = async (recipientId: string) => {
    try {
      // Make sure recipientId is a valid MongoDB ObjectId format
      if (!recipientId || recipientId.length !== 24) {
        console.error(`Invalid recipient ID format: ${recipientId}`);
        setRecipientIsOnline(false);
        return;
      }

      console.log(`Checking online status for recipient: ${recipientId}`);
      
      // Check via socket for status detection
      let isOnlineBySocket = false;
      
      // Check via socket if available
      if (socket && socket.connected) {
        // Emit a request for this specific user's status
        socket.emit('check_user_status', { userId: recipientId });
        
        // Check if we already know from our local state
        if (connectedUsers.has(recipientId)) {
          isOnlineBySocket = !!connectedUsers.get(recipientId);
          console.log(`User ${recipientId} status from socket cache: ${isOnlineBySocket ? 'ONLINE' : 'OFFLINE'}`);
        }
        
        // Set the status directly from socket information
        setRecipientIsOnline(isOnlineBySocket);
      } else {
        console.log(`Socket not available, marking user ${recipientId} as offline`);
        setRecipientIsOnline(false);
      }
    } catch (error) {
      console.error('Error checking recipient status:', error);
      setRecipientIsOnline(false);
    }
  };

  // Add polling mechanism for recipient status
  useEffect(() => {
    if (!activeChat || !activeChatData?.recipientId || !user) return;
    
    // Check if the recipientId is a valid MongoDB ObjectId (24 characters)
    if (activeChatData.recipientId.length !== 24) {
      console.error(`Invalid recipient ID in activeChatData: ${activeChatData.recipientId}`);
      return;
    }
    
    console.log('Setting up status polling for recipient:', activeChatData.recipientId);
    
    // Initial check
    checkRecipientStatus(activeChatData.recipientId);
    
    const statusInterval = setInterval(() => {
      checkRecipientStatus(activeChatData.recipientId);
    }, 5000); // Check every 5 seconds
    
    return () => {
      console.log('Clearing status polling interval');
      clearInterval(statusInterval);
    };
  }, [activeChat, activeChatData, user, statusRefreshCounter, connectedUsers]);

  // Add visibility change handler
  useEffect(() => {
    if (!user) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible - refreshing online statuses');
        
        // Re-establish socket connection if needed
        if (socket && !socket.connected) {
          console.log('Socket disconnected - reconnecting on tab visible');
          socket.connect();
        }
        
        // Request updated list of online users
        if (socket && socket.connected) {
          console.log('Requesting updated online users list');
          socket.emit('get_online_users');
          
          // Also trigger status refresh for active chat recipient
          if (activeChatData?.recipientId) {
            console.log(`Refreshing status for active chat recipient: ${activeChatData.recipientId}`);
            checkRecipientStatus(activeChatData.recipientId);
          }
        }
        
        // Force a check for the active recipient even if socket is not available
        if (activeChatData?.recipientId) {
          checkRecipientStatus(activeChatData.recipientId);
        }
      }
    };
    
    // Register the event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up the event listener
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, socket, activeChatData, checkRecipientStatus]);

  // Add function to format last seen time
  const formatLastOnline = (date: Date | null): string => {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

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
                      <div className="relative mr-3">
                        {recipientProfile ? (
                          <UserAvatar
                            url={recipientProfile.avatar?.url}
                            name={recipientProfile.firstName || recipientProfile.name || activeChatData?.recipientName || 'User'}
                            email={recipientProfile.email}
                            size="md"
                            bgColor="bg-blue-700"
                          />
                        ) : (
                          <UserAvatar
                            name={activeChatData?.recipientName || 'User'}
                            size="md"
                            bgColor="bg-blue-700"
                          />
                        )}
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ${
                          recipientIsOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        } border-2 border-white`}></span>
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          {recipientProfile ?
                            (recipientProfile.firstName && recipientProfile.lastName ?
                              `${recipientProfile.firstName} ${recipientProfile.lastName}` :
                              (recipientProfile.name || activeChatData?.recipientName)) :
                            activeChatData?.recipientName}
                        </h2>
                        {typingUsers.length > 0 ? (
                          <span className="text-xs text-green-200">typing...</span>
                        ) : (
                          <span className="text-xs text-blue-200">
                            {recipientIsOnline 
                              ? 'Online' 
                              : lastOnlineTime 
                                ? `Last seen ${formatLastOnline(lastOnlineTime)}` 
                                : 'Offline'}
                          </span>
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
                          className={`p-3 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md cursor-pointer transition-colors flex items-center ${chat.reportStatus === 'resolved' ? 'opacity-70' : ''
                            }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold mr-3">
                            {recipientName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <p className="font-medium text-gray-800 dark:text-gray-200">{recipientName}</p>
                              <div className="flex items-center">
                                {chat.reportStatus === 'resolved' && (
                                  <span className="mr-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                    Resolved
                                  </span>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {chat.lastMessage ? new Date(chat.lastMessage).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric'
                                  }) : ''}
                                </p>
                              </div>
                            </div>
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
                      // Direct comparison instead of relying on isSentByMe flag
                      const isFromMe = isMessageFromCurrentUser(message.sender, user?._id);
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
                              className={`max-w-[75%] p-3 rounded-lg ${isFromMe
                                  ? 'bg-blue-600 text-white rounded-br-none float-right'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none float-left'
                                }`}
                            >
                              <p className="break-words">{message.content}</p>
                              <div className="text-xs mt-1 opacity-70 flex justify-end items-center gap-1">
                                <span>
                                  {new Date(message.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {isFromMe && message.status && (
                                  <span title={`Status: ${message.status}`}>
                                    {message.status === 'read' ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : message.status === 'delivered' ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </span>
                                )}
                              </div>
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

            {/* Typing indicator */}
            {activeChat && typingUsers.length > 0 && (
              <div className="absolute bottom-[80px] left-4 z-10">
                <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-2xl rounded-bl-none shadow-md max-w-[200px] animate-fade-in">
                  <div className="typing-indicator">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
              {activeChat ? (
                <>
                  {/* Check if chat is related to a resolved report */}
                  {isReportResolved() ? (
                    <div className="bg-green-500 text-white p-4 rounded-md text-center">
                      <p className="font-medium">This issue has been resolved. Thank you for your help!</p>
                      <p className="text-sm mt-1">Messaging for this report has been disabled.</p>

                      {/* Option to reopen for report owner */}
                      {reportOwnership.isReportOwner && (
                        <button
                          onClick={handleReopenReport}
                          className="mt-3 bg-white text-green-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors"
                        >
                          Reopen Report
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <textarea
                          value={newMessage}
                          onChange={handleInputChange}
                          onKeyPress={handleKeyPress}
                          placeholder="Type a message..."
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                          rows={1}
                        />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || isReportResolved()}
                        role="send"
                        className={`p-2 rounded-full ${!newMessage.trim() || isReportResolved()
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                      >
                        <FaPaperPlane />
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Typing indicator CSS */}
      <style>
        {`
          .typing-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px 0;
          }
          
          .typing-indicator .dot {
            height: 8px;
            width: 8px;
            margin: 0 2px;
            background-color: #9ca3af;
            border-radius: 50%;
            display: inline-block;
            animation: typingBounce 1.4s infinite ease-in-out both;
          }
          
          .typing-indicator .dot:nth-child(1) {
            animation-delay: -0.32s;
          }
          
          .typing-indicator .dot:nth-child(2) {
            animation-delay: -0.16s;
          }
          
          .typing-indicator .dot:nth-child(3) {
            animation-delay: 0s;
          }
          
          @keyframes typingBounce {
            0%, 80%, 100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-8px);
            }
          }
          
          @keyframes fade-in {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }
          
          .animate-fade-in {
            animation: fade-in 0.3s ease-out;
          }
        `}
      </style>
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
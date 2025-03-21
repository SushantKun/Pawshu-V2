import React, { createContext, useContext, useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface ChatContextType {
  socket: Socket | null;
  unreadChats: number;
  setUnreadChats: (count: number) => void;
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  currentChatId: string | null;
  setCurrentChatId: (chatId: string | null) => void;
}

const ChatContext = createContext<ChatContextType>({
  socket: null,
  unreadChats: 0,
  setUnreadChats: () => {},
  isChatOpen: false,
  setIsChatOpen: () => {},
  currentChatId: null,
  setCurrentChatId: () => {},
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadChats, setUnreadChats] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
        auth: {
          token: localStorage.getItem('token')
        }
      });

      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Connected to chat server');
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from chat server');
      });

      newSocket.on('newMessage', (data) => {
        // Only increment count if:
        // 1. The message is not from the current user (sender is not the current user)
        // 2. The chat window is not open OR the user is viewing a different chat
        
        const isMessageForCurrentChat = currentChatId === data.chatId;
        const isFromCurrentUser = data.message.sender?._id === user._id;
        
        // Don't increment for user's own messages, only increment for incoming messages from others
        if (!isFromCurrentUser && (!isChatOpen || (isChatOpen && !isMessageForCurrentChat))) {
          setUnreadChats(prev => prev + 1);
        }
      });

      newSocket.on('messagesRead', (data) => {
        // When messages are read, reset the unread count if relevant
        const isReadingCurrentMessages = data?.chatId === currentChatId;
        
        // If the current user is the one who read the messages, update the unread count
        if (data?.readBy === user._id) {
          setUnreadChats(0);
        }
      });

      return () => {
        newSocket.off('connect');
        newSocket.off('disconnect');
        newSocket.off('newMessage');
        newSocket.off('messagesRead');
        newSocket.close();
      };
    }
  }, [user]);

  return (
    <ChatContext.Provider value={{ socket, unreadChats, setUnreadChats, isChatOpen, setIsChatOpen, currentChatId, setCurrentChatId }}>
      {children}
    </ChatContext.Provider>
  );
};

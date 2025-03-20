import React, { createContext, useContext, useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface ChatContextType {
  socket: Socket | null;
  unreadChats: number;
  setUnreadChats: (count: number) => void;
}

const ChatContext = createContext<ChatContextType>({
  socket: null,
  unreadChats: 0,
  setUnreadChats: () => {},
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadChats, setUnreadChats] = useState(0);
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

      newSocket.on('newMessage', () => {
        setUnreadChats(prev => prev + 1);
      });

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  return (
    <ChatContext.Provider value={{ socket, unreadChats, setUnreadChats }}>
      {children}
    </ChatContext.Provider>
  );
};

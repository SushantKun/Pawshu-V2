import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatList from '../components/chat/ChatList';
import ChatDetail from '../components/chat/ChatDetail';

const Chat: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isChatDetail = location.pathname.match(/\/chat\/[^/]+$/);

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden pt-16">
      <div className="container mx-auto px-4 max-w-5xl h-full pb-4 flex flex-col">
        <div className="flex-shrink-0 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isChatDetail ? 'Chat Messages' : 'Your Messages'}
          </h1>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<ChatList />} />
            <Route path="/:chatId" element={<ChatDetail />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Chat; 
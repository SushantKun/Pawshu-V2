import React, { useState } from 'react';
import { FaComment, FaTimesCircle } from 'react-icons/fa';
import ChatInterface from './ChatInterface';

const ChatButton: React.FC = () => {
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {showChat ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <button
            onClick={() => setShowChat(false)}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            aria-label="Close chat"
          >
            <FaTimesCircle size={20} />
          </button>
          <ChatInterface />
        </div>
      ) : (
        <button
          onClick={() => setShowChat(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg transition-colors"
          aria-label="Open chat"
        >
          <FaComment size={24} />
        </button>
      )}
    </div>
  );
};

export default ChatButton;

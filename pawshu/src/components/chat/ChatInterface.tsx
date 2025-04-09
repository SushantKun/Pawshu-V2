import React from 'react';

const ChatInterface: React.FC = () => {
  return (
    <div className="w-96 h-[500px] p-4">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">Chat Support</h2>
      <div className="h-[400px] overflow-y-auto border dark:border-gray-700 rounded-lg p-4 mb-4">
        {/* Chat messages will go here */}
        <p className="text-gray-600 dark:text-gray-400 text-center">
          No messages yet. Start a conversation!
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatInterface; 
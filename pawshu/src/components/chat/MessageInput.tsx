import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';

interface MessageInputProps {
  chatId: string;
  onSendMessage: (content: string, attachment?: File) => void;
  socket: Socket | null;
}

const MessageInput: React.FC<MessageInputProps> = ({ chatId, onSendMessage, socket }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { user } = useAuth();

  // Handle typing indicator
  useEffect(() => {
    if (!socket || !chatId) return;

    const handleTyping = () => {
      setIsTyping(true);
      socket.emit('typing', { chatId });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socket.emit('stopTyping', { chatId });
      }, 1000);
    };

    const handleStopTyping = () => {
      setIsTyping(false);
      socket.emit('stopTyping', { chatId });
    };

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, chatId]);

  const handleSend = () => {
    if (message.trim() || attachment) {
      onSendMessage(message.trim(), attachment || undefined);
      setMessage('');
      setAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachment(file);
    }
  };

  const onEmojiClick = (emojiObject: any) => {
    setMessage(prev => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="flex items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        title="Attach file"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
      <div className="flex-1 relative">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="w-full px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
        {attachment && (
          <div className="absolute bottom-full mb-2 left-0 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">{attachment.name}</span>
            <button
              onClick={() => setAttachment(null)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}
      </div>
      <button
        onClick={handleSend}
        disabled={!message.trim() && !attachment}
        className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  );
};

export default MessageInput; 
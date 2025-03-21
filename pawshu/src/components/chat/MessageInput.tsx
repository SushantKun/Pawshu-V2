import React, { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';

type UploadHandler = (file: File) => Promise<{
  url: string;
  type: string;
  name: string;
  thumbnailUrl?: string;
} | null>;

interface MessageInputProps {
  chatId: string;
  onSendMessage: (content: string, file?: File) => void;
  onFileUpload?: UploadHandler;
  socket?: Socket | null;
}

const MessageInput: React.FC<MessageInputProps> = ({
  chatId,
  onSendMessage,
  onFileUpload,
  socket
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isButtonDisabled = (message.trim() === '' && !selectedFile) || isSending;

  useEffect(() => {
    // Focus the input field when the component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Clean up typing timeout on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const emitTyping = () => {
    if (!isTyping && socket) {
      socket.emit('typing', { chatId });
      setIsTyping(true);

      // Stop typing signal after 3 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { chatId });
        setIsTyping(false);
      }, 3000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    emitTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isButtonDisabled) return;

    setIsSending(true);

    try {
      // If there's a file to upload, pass it to onSendMessage
      if (selectedFile) {
        onSendMessage(message.trim(), selectedFile);
      } else {
        // Just send a regular text message
        onSendMessage(message.trim());
      }
      
      // Reset state
      setMessage('');
      setSelectedFile(null);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
      // Focus on input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
      // Stop typing indicator
      if (socket && isTyping) {
        socket.emit('stopTyping', { chatId });
        setIsTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex">
        {/* File Attachment Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-gray-400 hover:text-gray-200 transition-colors focus:outline-none"
            title="Attach file"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
        </div>

        {/* Message Input */}
        <div className="flex-grow">
          <input
            type="text"
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full p-3 bg-gray-700 text-white border-none rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            disabled={isSending}
            ref={inputRef}
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={isButtonDisabled}
          className={`
            p-3 rounded-md ml-2 flex items-center justify-center
            ${isButtonDisabled 
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700 transition-colors'}
          `}
        >
          {isSending ? (
            <div className="h-6 w-6 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </form>

      {/* File Preview */}
      {selectedFile && (
        <div className="mt-2 p-2 bg-gray-800 rounded-md flex items-center justify-between">
          <div className="flex items-center">
            <svg 
              className="h-5 w-5 text-gray-400 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" 
              />
            </svg>
            <span className="text-sm text-gray-200 truncate max-w-xs">
              {selectedFile.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="ml-2 text-gray-400 hover:text-gray-200"
          >
            <svg 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageInput; 
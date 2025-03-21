import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatList from './ChatList';
import ChatDetail from './ChatDetail';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface ChatWindowProps {
  onClose?: () => void;
  selectedChatId?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ onClose, selectedChatId }) => {
  const { chatId: urlChatId } = useParams<{ chatId: string }>();
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedId, setSelectedId] = useState<string | undefined>(selectedChatId);
  const [showChatList, setShowChatList] = useState(true);
  const { user } = useAuth();
  const { setCurrentChatId } = useChat();
  
  // Use the selectedChatId prop if provided, otherwise use the URL param
  const chatId = selectedChatId || urlChatId;

  useEffect(() => {
    // Check if user is authenticated, if not redirect to login
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    // Handle window resize for responsive layout
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // When switching from mobile to desktop, show both panels
      if (!mobile) {
        setShowChatList(true);
      } else if (chatId) {
        // On mobile, if there's a chat open, hide the list
        setShowChatList(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chatId]);

  // When chatId changes, on mobile we should show the detail view
  useEffect(() => {
    if (isMobile && (chatId || selectedId)) {
      setShowChatList(false);
    }
  }, [chatId, selectedId, isMobile]);

  const toggleChatList = () => {
    // Reset internal chat ID when going back to the list
    if (!showChatList) {
      console.log('Going back to chat list, resetting internalChatId');
      setSelectedId(undefined);
    }
    setShowChatList(!showChatList);
  };

  // Create a back handler that explicitly resets the internal chat ID
  const handleBackToList = () => {
    console.log('Back button clicked, resetting chat view');
    setSelectedId(undefined);
    setShowChatList(true);
  };

  // Update internal state when the prop changes
  useEffect(() => {
    if (selectedChatId) {
      setSelectedId(selectedChatId);
      if (isMobile) {
        setShowChatList(false);
      }
    }
  }, [selectedChatId, isMobile]);

  // When internalChatId is set by the ChatList component, update view
  useEffect(() => {
    if (selectedId) {
      console.log('Chat selected in popup:', selectedId);
      setShowChatList(false);
    }
  }, [selectedId]);

  // Log when selectedChatId prop changes
  useEffect(() => {
    console.log('selectedChatId prop changed to:', selectedChatId);
  }, [selectedChatId]);

  // Reset internal state when component unmounts
  useEffect(() => {
    return () => {
      console.log('ChatWindow unmounting, resetting state');
      setSelectedId(undefined);
      setShowChatList(true);
    };
  }, []);

  // Create a wrapper for the onClose function to reset internal state
  const handleClose = () => {
    console.log('Closing chat window, resetting state');
    setSelectedId(undefined);
    setShowChatList(true);
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    // Update the context with the current chat ID
    setCurrentChatId(selectedId || null);
  }, [selectedId, setCurrentChatId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 border-4 border-t-transparent border-white rounded-full animate-spin mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden shadow-2xl border border-gray-700">
      {/* Close button */}
      {onClose && (
        <button 
          onClick={handleClose}
          className="absolute top-2 right-2 z-50 p-1.5 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-colors shadow-lg"
          aria-label="Close chat"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      {/* Back button for mobile */}
      {chatId && !showChatList && (
        <button 
          onClick={handleBackToList}
          className="absolute top-2 left-2 z-40 p-1.5 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-colors shadow-lg"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      
      {/* Chat List Panel */}
      <div 
        className={`${
          showChatList ? 'block' : 'hidden'
        } w-full h-full overflow-hidden`}
      >
        <ChatList key="chat-list" setChatId={setSelectedId} />
      </div>
      
      {/* Chat Detail Panel */}
      <div 
        className={`${
          !showChatList ? 'block' : 'hidden'
        } w-full h-full`}
      >
        {chatId || selectedId ? (
          <ChatDetail 
            key={`chat-detail-${chatId || selectedId}`}
            chatId={chatId || selectedId || ''} 
            onBackClick={handleBackToList} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-gray-400 p-4">
            <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
            <h2 className="text-lg font-semibold text-white mb-2">Your Messages</h2>
            <p className="text-center text-sm">
              Select a conversation to start chatting
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;

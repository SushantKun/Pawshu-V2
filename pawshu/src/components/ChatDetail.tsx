import React, { useEffect, useRef } from 'react';

// Add an effect to mark messages as read when viewed
useEffect(() => {
  if (!chatId || !user?._id || !socketRef.current) return;

  // Mark messages as read when they are viewed
  const markMessagesAsRead = () => {
    console.log('Marking messages as read in chat:', chatId);
    socketRef.current?.emit('readMessages', { chatId });
    
    // Also update messages locally to reflect read status immediately
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.sender && msg.sender._id !== user._id && !msg.read
          ? { ...msg, status: 'read', read: true }
          : msg
      )
    );
  };

  // Call once when component mounts or chatId changes
  markMessagesAsRead();
  
  // Set up an interval to refresh read status periodically
  const intervalId = setInterval(markMessagesAsRead, 5000);
  
  return () => {
    clearInterval(intervalId);
  };
}, [chatId, user?._id, socketRef]); 
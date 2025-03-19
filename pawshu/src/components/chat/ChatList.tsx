import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  _id: string;
  sender: {
    _id: string;
    name: string;
    email: string;
  };
  content: string;
  timestamp: string;
  read: boolean;
}

interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  lastMessage: {
    content: string;
    timestamp: string;
    sender: {
      _id: string;
      name: string;
      email: string;
    };
  };
  context: {
    type: 'lost-found' | 'appointment';
    referenceId: string;
  };
  messages?: Message[];
}

const ChatList = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchChats = async () => {
      if (!user) return;

      try {
        const response = await axios.get('http://localhost:5000/api/chats', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setChats(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching chats:', error);
        setError('Failed to load your conversations');
        setLoading(false);
      }
    };

    fetchChats();
  }, [user]);

  // Get the other participant in the chat (not the current user)
  const getOtherParticipant = (chat: Chat) => {
    if (!user) return { name: 'Unknown' };
    return chat.participants.find(p => p._id !== user._id) || { name: 'Unknown' };
  };

  // Check if there are unread messages in the chat
  const hasUnreadMessages = (chat: Chat) => {
    if (!user) return false;
    return chat.messages?.some(msg => 
      !msg.read && msg.sender._id !== user._id
    ) || false;
  };

  // Format timestamp to relative time (e.g., "2 hours ago")
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  if (loading) return (
    <div className="p-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading conversations...</p>
    </div>
  );
  
  if (error) return (
    <div className="p-8 text-center">
      <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-lg inline-block mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error</h3>
      <p className="text-gray-600 dark:text-gray-400">{error}</p>
    </div>
  );
  
  if (chats.length === 0) return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
        Conversations
      </h2>
      <div className="p-8 text-center">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/20 p-5 rounded-full inline-flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No conversations yet</h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
          Your message conversations will appear here. Start by contacting a pet owner from the Lost & Found page.
        </p>
        <button 
          onClick={() => window.location.href = '/lost-found'}
          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Go to Lost & Found
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden h-full flex flex-col">
      <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
        <span>Conversations</span>
        <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 py-1 px-2 rounded-full">
          {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
        </span>
      </h2>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto flex-1">
        {chats.map(chat => {
          const otherParticipant = getOtherParticipant(chat);
          const contextLabel = chat.context.type === 'lost-found' 
            ? 'Lost & Found' 
            : chat.context.type === 'appointment'
              ? 'Appointment'
              : '';
              
          return (
            <li key={chat._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Link 
                to={`/chat/${chat._id}`} 
                className="flex items-center p-3"
              >
                <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {otherParticipant.name?.charAt(0) || '?'}
                </div>
                
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <span className={`font-medium truncate ${hasUnreadMessages(chat) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                      {otherParticipant.name}
                      {hasUnreadMessages(chat) && (
                        <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </span>
                    <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
                      {chat.lastMessage && formatTimestamp(chat.lastMessage.timestamp)}
                    </span>
                  </div>
                  
                  <div className={`text-sm truncate ${
                    hasUnreadMessages(chat) 
                      ? 'text-gray-900 dark:text-gray-200 font-medium' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {chat.lastMessage ? (
                      <>
                        {chat.lastMessage.sender._id === user?._id ? 'You: ' : ''}
                        {chat.lastMessage.content}
                      </>
                    ) : (
                      'No messages yet'
                    )}
                  </div>
                  
                  {contextLabel && (
                    <div className="mt-1">
                      <span className="text-xs py-0.5 px-1.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
                        {contextLabel}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ChatList; 
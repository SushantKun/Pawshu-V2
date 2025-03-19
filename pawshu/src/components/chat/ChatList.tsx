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

  // Format timestamp to relative time (e.g., "2 hours ago")
  const formatTimestamp = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
        Conversations
      </h2>
      <div className="p-8 text-center">
        <div className="bg-blue-100 dark:bg-blue-900/20 p-4 rounded-lg inline-block mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No conversations yet</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Your message conversations will appear here. Start by contacting a pet owner from the Lost & Found page.
        </p>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
        Conversations
      </h2>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {chats.map(chat => {
          const otherParticipant = getOtherParticipant(chat);
          return (
            <li key={chat._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <Link 
                to={`/chat/${chat._id}`} 
                className="flex items-center p-4"
              >
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                  {otherParticipant.name?.charAt(0) || '?'}
                </div>
                
                <div className="ml-3 flex-1">
                  <div className="flex items-baseline">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {otherParticipant.name}
                    </span>
                    <span className="ml-auto text-sm text-gray-500">
                      {chat.lastMessage && formatTimestamp(chat.lastMessage.timestamp)}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {chat.lastMessage ? (
                      <>
                        {chat.lastMessage.sender._id === user?._id ? 'You: ' : ''}
                        {chat.lastMessage.content}
                      </>
                    ) : (
                      'No messages yet'
                    )}
                  </div>
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
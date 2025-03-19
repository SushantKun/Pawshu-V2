import { Routes, Route, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatList from '../components/chat/ChatList';
import ChatDetail from '../components/chat/ChatDetail';

const Chat = () => {
  const { user } = useAuth();

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="max-w-6xl mx-auto pt-16 px-4 sm:px-6 lg:px-8 pb-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Messages</h1>
      
      <Routes>
        <Route index element={<ChatList />} />
        <Route path=":chatId" element={<ChatDetail />} />
      </Routes>
    </div>
  );
};

export default Chat; 
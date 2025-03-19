import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface PetReport {
  _id: string;
  type: 'lost' | 'found';
  petType: string;
  breed?: string;
  location: string;
  date: string;
  description: string;
  images: Array<{ url: string }>;
  status: 'open' | 'resolved' | 'closed';
  contact: {
    name: string;
    email: string;
    phone?: string;
  };
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  additionalDetails?: {
    color?: string;
    size?: string;
    age?: string;
    gender?: string;
    microchipped?: boolean;
    collar?: boolean;
    distinctiveFeatures?: string;
  };
}

interface LostFoundCardProps {
  report: PetReport;
  onStatusChange?: () => void;
}

const LostFoundCard = ({ report, onStatusChange }: LostFoundCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPP');
  };

  const isOwner = Boolean(user && report.userId && user._id === report.userId._id);

  const handleContact = async () => {
    if (!user) {
      toast.error('Please log in to contact the owner');
      navigate('/login');
      return;
    }

    if (isOwner) {
      toast.error('This is your own report');
      return;
    }

    try {
      setLoading(true);
      toast.loading('Initiating chat...');
      
      // Create or get existing chat
      const response = await axios.post('http://localhost:5000/api/chats/initiate', {
        recipientId: report.userId._id,
        contextType: 'lost-found',
        referenceId: report._id,
        initialMessage: `Hi, I'm interested in your ${report.type === 'lost' ? 'lost' : 'found'} ${report.petType}.`
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      setLoading(false);
      toast.dismiss();
      
      if (response.data && response.data._id) {
        // Navigate to the chat
        toast.success('Chat initiated successfully');
        navigate(`/chat/${response.data._id}`);
      } else {
        toast.error('Failed to initiate chat: Invalid response from server');
        console.error('Invalid chat response:', response.data);
      }
    } catch (error: any) {
      setLoading(false);
      toast.dismiss();
      console.error('Error initiating chat:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate chat');
    }
  };

  const handleStatusChange = async (newStatus: 'open' | 'resolved' | 'closed') => {
    if (!isOwner) {
      toast.error('Only the owner can change the status');
      return;
    }

    try {
      setLoading(true);
      await axios.patch(`http://localhost:5000/api/lost-found/${report._id}/status`, 
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      setLoading(false);
      toast.success(`Status updated to ${newStatus}`);
      if (onStatusChange) onStatusChange();
    } catch (error) {
      setLoading(false);
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Main image */}
      <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
        {report.images && report.images.length > 0 ? (
          <img 
            src={report.images[0].url} 
            alt={`${report.type} ${report.petType}`} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            No image available
          </div>
        )}
        
        {/* Status badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 text-xs font-semibold rounded-full ${
          report.status === 'open' 
            ? 'bg-green-500 text-white' 
            : report.status === 'resolved' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-500 text-white'
        }`}>
          {report.status.toUpperCase()}
        </div>
        
        {/* Type badge */}
        <div className={`absolute top-2 left-2 px-2 py-1 text-xs font-semibold rounded-full ${
          report.type === 'lost' ? 'bg-red-500 text-white' : 'bg-purple-500 text-white'
        }`}>
          {report.type.toUpperCase()}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold">
            {report.type === 'lost' ? 'Lost' : 'Found'} {report.petType}
            {report.breed && ` (${report.breed})`}
          </h3>
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          <p><strong>Location:</strong> {report.location}</p>
          <p><strong>Date:</strong> {formatDate(report.date)}</p>
          {report.additionalDetails?.color && (
            <p><strong>Color:</strong> {report.additionalDetails.color}</p>
          )}
        </div>
        
        <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-3">
          {report.description}
        </p>
        
        <div className="flex flex-col space-y-2">
          <button
            onClick={handleContact}
            disabled={loading || isOwner}
            className={`w-full py-2 rounded-md text-white font-medium ${
              loading || isOwner ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {loading ? 'Loading...' : isOwner ? 'Your Post' : 'Contact'}
          </button>
          
          {isOwner && (
            <div className="flex space-x-2 mt-2">
              <select
                disabled={loading}
                value={report.status}
                onChange={(e) => handleStatusChange(e.target.value as 'open' | 'resolved' | 'closed')}
                className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LostFoundCard; 
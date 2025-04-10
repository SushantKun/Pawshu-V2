import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { FaComment, FaTrash } from 'react-icons/fa';

// Create a configured axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add auth token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Define the report status type to ensure consistency
type ReportStatus = 'open' | 'resolved' | 'closed';

interface PetReport {
  _id: string;
  type: 'lost' | 'found';
  petType: string;
  breed?: string;
  location: string;
  date: string;
  description: string;
  images: Array<{ url: string }>;
  status: ReportStatus;
  contact: {
    name: string;
    email: string;
    phone?: string;
  };
  userId: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    name?: string;
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
  const [showContact, setShowContact] = useState(false);
  // Track the current status state to handle UI updates
  const [currentStatus, setCurrentStatus] = useState<ReportStatus>(report.status);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPP');
  };

  const isOwner = Boolean(user && report.userId && user._id === report.userId._id);

  const handleContact = () => {
    if (!user) {
      toast.error('Please log in to view contact information');
      navigate('/login');
      return;
    }

    if (isOwner) {
      toast.error('This is your own report');
      return;
    }

    setShowContact(!showContact);
  };

  const handleStartChat = async () => {
    if (!user) {
      toast.error('Please log in to start a chat');
      navigate('/login');
      return;
    }

    if (isOwner) {
      toast.error('You cannot chat with yourself');
      return;
    }

    // Prevent chatting for resolved reports
    if (currentStatus === 'resolved') {
      toast.error('This report has been resolved. Messaging has been disabled.');
      return;
    }

    try {
      setLoading(true);

      // Get the recipient name
      const recipientName = report.userId.name ||
        (report.userId.firstName && report.userId.lastName ?
          `${report.userId.firstName} ${report.userId.lastName}` :
          report.contact.name);

      // Use the global startChat function from window
      if ((window as any).startChat) {
        (window as any).startChat(
          report.userId._id,
          recipientName,
          {
            reportId: report._id,
            reportType: report.type,
            petType: report.petType
          }
        );
      } else {
        toast.error('Chat functionality is currently unavailable');
      }
    } catch (error: any) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ReportStatus) => {
    if (!isOwner) {
      toast.error('Only the owner can change the status');
      return;
    }

    if (newStatus === currentStatus) {
      return; // No change needed
    }

    try {
      setLoading(true);
      
      const response = await api.put(`/api/lost-found/${report._id}/status`, { status: newStatus });
      
      if (response.status === 200) {
        setCurrentStatus(newStatus);
        toast.success(`Status updated to ${newStatus}`);
        if (onStatusChange) onStatusChange();
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!isOwner) {
      toast.error('Only the owner can delete this report');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.delete(`/api/lost-found/${report._id}`);
      
      if (response.status === 200) {
        toast.success('Report deleted successfully');
        if (onStatusChange) onStatusChange();
      } else {
        toast.error('Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    } finally {
      setLoading(false);
    }
  };

  const reopenReport = async () => {
    if (!isOwner) {
      toast.error('Only the owner can reopen this report');
      return;
    }

    try {
      setLoading(true);
      const response = await api.put(`/api/lost-found/${report._id}/status`, { status: 'open' });
      
      if (response.status === 200) {
        setCurrentStatus('open');
        toast.success('Report reopened successfully');
        if (onStatusChange) onStatusChange();
      } else {
        toast.error('Failed to reopen report');
      }
    } catch (error) {
      console.error('Error reopening report:', error);
      toast.error('Failed to reopen report');
    } finally {
      setLoading(false);
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
          currentStatus === 'open'
            ? 'bg-green-500 text-white'
            : currentStatus === 'resolved'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-500 text-white'
          }`}>
          {currentStatus.toUpperCase()}
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

        {showContact && (
          <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h4 className="font-semibold mb-2">Contact Information:</h4>
            <p><strong>Name:</strong> {report.contact.name}</p>
            <p><strong>Email:</strong> {report.contact.email}</p>
            {report.contact.phone && (
              <p><strong>Phone:</strong> {report.contact.phone}</p>
            )}
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <button
            onClick={handleContact}
            disabled={loading || isOwner || currentStatus === 'resolved'}
            className={`w-full py-2 rounded-md text-white font-medium ${
              loading || isOwner || currentStatus === 'resolved' ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {loading ? 'Loading...' : isOwner ? 'Your Post' : currentStatus === 'resolved' ? 'Report Resolved' : showContact ? 'Hide Contact' : 'Show Contact'}
          </button>

          {/* Only show contact button for non-resolved reports */}
          {!isOwner && currentStatus !== 'resolved' && (
            <button
              onClick={handleStartChat}
              disabled={loading}
              className="w-full py-2 rounded-md text-white font-medium bg-green-500 hover:bg-green-600 flex items-center justify-center gap-2"
            >
              <FaComment size={16} />
              Contact
            </button>
          )}
          
          {/* For resolved reports, show a message instead of the contact button for non-owners */}
          {!isOwner && currentStatus === 'resolved' && (
            <div className="bg-green-500 text-white p-3 rounded-md text-center">
              <p className="text-sm font-medium">This report has been resolved.</p>
              <p className="text-xs mt-1">The owner has marked this issue as resolved.</p>
            </div>
          )}

          {isOwner && (
            <div className="flex flex-col space-y-2 mt-2 w-full">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {currentStatus === 'resolved' ? 'Report Actions:' : 'Update Status:'}
              </label>
              
              {/* Actions based on status */}
              {(() => {
                if (currentStatus === 'resolved') {
                  // Show delete and reopen buttons when resolved
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={reopenReport}
                        disabled={loading}
                        className="py-2 rounded-md text-white font-medium bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        Reopen
                      </button>
                      <button
                        onClick={handleDeleteReport}
                        disabled={loading}
                        className="py-2 rounded-md text-white font-medium bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        Delete
                      </button>
                    </div>
                  );
                } else {
                  // Show status buttons if not resolved
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleStatusChange('open')}
                        disabled={loading || currentStatus === 'open'}
                        className={`py-2 rounded-md text-white font-medium ${
                          currentStatus === 'open' 
                            ? 'bg-green-600' 
                            : loading 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-green-500 hover:bg-green-600'
                        }`}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleStatusChange('resolved')}
                        disabled={loading}
                        className={`py-2 rounded-md text-white font-medium ${
                          loading 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                      >
                        Resolved
                      </button>
                    </div>
                  );
                }
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LostFoundCard; 
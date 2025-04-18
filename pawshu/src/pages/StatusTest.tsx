import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface UserStatus {
  userId: string;
  name: string;
  email: string;
  isOnline: boolean;
  lastActive: string | null;
  lastChecked: Date;
}

const StatusTest: React.FC = () => {
  const { user } = useAuth();
  const [userIdToCheck, setUserIdToCheck] = useState('');
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Add a user ID to monitor
  const handleAddUser = async () => {
    if (!userIdToCheck.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/users/${userIdToCheck}/online-status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Also fetch user profile to get name
      const profileResponse = await axios.get(`http://localhost:5000/api/users/${userIdToCheck}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const name = profileResponse.data?.firstName && profileResponse.data?.lastName 
        ? `${profileResponse.data.firstName} ${profileResponse.data.lastName}`
        : profileResponse.data?.name || 'Unknown';

      const email = profileResponse.data?.email || 'No email';

      // Add to list of monitored users
      setUserStatuses(prev => [
        ...prev.filter(u => u.userId !== userIdToCheck),
        {
          userId: userIdToCheck,
          name,
          email,
          isOnline: response.data.isOnline,
          lastActive: response.data.lastActive,
          lastChecked: new Date()
        }
      ]);

      setUserIdToCheck('');
      setError('');
    } catch (err: any) {
      console.error('Error checking user status:', err);
      setError(err.response?.data?.message || 'Error checking user status');
    } finally {
      setLoading(false);
    }
  };

  // Poll for status updates
  useEffect(() => {
    if (userStatuses.length === 0) return;

    const intervalId = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Check all user statuses
        const updatedStatuses = await Promise.all(
          userStatuses.map(async (status) => {
            try {
              const response = await axios.get(`http://localhost:5000/api/users/${status.userId}/online-status`, {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });

              return {
                ...status,
                isOnline: response.data.isOnline,
                lastActive: response.data.lastActive,
                lastChecked: new Date(),
                debug: response.data.debug
              };
            } catch (err) {
              console.error(`Error checking status for user ${status.userId}:`, err);
              return status;
            }
          })
        );

        setUserStatuses(updatedStatuses);
      } catch (err) {
        console.error('Error updating statuses:', err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [userStatuses]);

  // Format time difference
  const formatTimeDiff = (date: string | null) => {
    if (!date) return 'never';
    
    const now = new Date();
    const lastActive = new Date(date);
    const diffMs = now.getTime() - lastActive.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} minutes ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours ago`;
    return `${Math.floor(diffSecs / 86400)} days ago`;
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Online Status Tester</h1>
      
      {user ? (
        <div>
          <p className="mb-4">Your User ID: <span className="font-mono bg-gray-100 p-1 rounded">{user._id}</span></p>
          
          <div className="flex mb-6">
            <input
              type="text"
              value={userIdToCheck}
              onChange={(e) => setUserIdToCheck(e.target.value)}
              placeholder="Enter user ID to check status"
              className="flex-1 border border-gray-300 rounded-l p-2"
            />
            <button 
              onClick={handleAddUser}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600 disabled:bg-blue-300"
            >
              {loading ? 'Checking...' : 'Add'}
            </button>
          </div>
          
          {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">{error}</div>}
          
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userStatuses.map(status => (
                  <tr key={status.userId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{status.name}</div>
                          <div className="text-sm text-gray-500">{status.email}</div>
                          <div className="text-xs text-gray-400 font-mono">{status.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        status.isOnline 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {status.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {status.lastActive ? formatTimeDiff(status.lastActive) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => setUserStatuses(prev => prev.filter(u => u.userId !== status.userId))}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                
                {userStatuses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No users added yet. Enter a user ID above to monitor their status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 text-sm text-gray-500">
            <p>Last updated: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
          Please log in to use this feature.
        </div>
      )}
    </div>
  );
};

export default StatusTest; 
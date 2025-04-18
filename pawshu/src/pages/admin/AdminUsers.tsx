import { useState, useEffect, useCallback } from 'react';
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import io from 'socket.io-client';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const PencilIconComponent = PencilIcon as IconComponent;
const TrashIconComponent = TrashIcon as IconComponent;
const PlusIconComponent = PlusIcon as IconComponent;
const MagnifyingGlassIconComponent = MagnifyingGlassIcon as IconComponent;
const FunnelIconComponent = FunnelIcon as IconComponent;
const ArrowPathIconComponent = ArrowPathIcon as IconComponent;

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  lastLogin?: string;
  status?: 'active' | 'inactive';
  lastActive?: string;
  isOnline?: boolean;
  lastStatusUpdate?: number;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
}

const API_URL = 'http://localhost:5000/api';

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  // Initialize Socket.IO connection with version tracking
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const socket = io('http://localhost:5000', {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    // Add a debounce timer for status updates
    let statusUpdateTimer: NodeJS.Timeout;

    socket.on('user_status_changed', (data: { 
      userId: string; 
      isOnline: boolean; 
      lastActive: string;
      version: number;
    }) => {
      console.log('Received status update:', data);
      
      // Clear any pending status update
      clearTimeout(statusUpdateTimer);
      
      // Delay the status update slightly to handle rapid changes
      statusUpdateTimer = setTimeout(() => {
        setUsers(prevUsers => 
          prevUsers.map(user => {
            if (user._id === data.userId) {
              // Only update if the incoming version is newer than what we have
              if (!user.lastStatusUpdate || data.version > user.lastStatusUpdate) {
                console.log(`Updating status for user ${user.email} to ${data.isOnline ? 'online' : 'offline'} (version: ${data.version})`);
                return {
                  ...user,
                  isOnline: data.isOnline,
                  lastActive: data.lastActive,
                  lastStatusUpdate: data.version
                };
              }
              console.log(`Ignoring older status update for user ${user.email} (current: ${user.lastStatusUpdate}, received: ${data.version})`);
            }
            return user;
          })
        );
      }, 100); // Small delay to handle race conditions
    });

    socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    return () => {
      clearTimeout(statusUpdateTimer);
      socket.disconnect();
    };
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('Admin authentication required');
        setLoading(false);
        return;
      }

      console.log('Fetching users with token:', token ? 'Token present' : 'No token');
      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data) {
        console.log('Users fetched successfully:', response.data.length);
        // Preserve existing version numbers when updating users
        setUsers(prevUsers => {
          const newUsers = response.data.map((newUser: User) => {
            const existingUser = prevUsers.find(u => u._id === newUser._id);
            return {
              ...newUser,
              lastStatusUpdate: existingUser?.lastStatusUpdate || Date.now(),
              isOnline: existingUser?.isOnline ?? newUser.isOnline
            };
          });
          return newUsers;
        });
        setError('');
      } else {
        console.error('No data received from server');
        setError('No data received from server');
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      if (err.response?.status === 401) {
        setError('Admin authentication required. Please log in again.');
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
      } else {
        setError(err.response?.data?.message || 'Failed to fetch users');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    
    // Set up a periodic refresh with a longer interval
    const statusInterval = setInterval(() => {
      console.log('Refreshing user status...');
      fetchUsers();
    }, 30000); // Increased to 30 seconds since we have real-time updates
    
    return () => clearInterval(statusInterval);
  }, [fetchUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user'
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    resetForm();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        toast.error('Admin authentication required');
        setLoading(false);
        return;
      }

      await axios.post(`${API_URL}/admin/users`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('User added successfully!');
      closeAddModal();
      fetchUsers();
    } catch (err: any) {
      console.error('Error adding user:', err);
      toast.error(err.response?.data?.message || 'Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        toast.error('Admin authentication required');
        setLoading(false);
        return;
      }

      const updateData = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        ...(formData.password ? { password: formData.password } : {})
      };

      await axios.put(`${API_URL}/admin/users/${selectedUser._id}`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      toast.success('User updated successfully!');
      closeEditModal();
      fetchUsers();
    } catch (err: any) {
      console.error('Error updating user:', err);
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        toast.error('Admin authentication required');
        setLoading(false);
        return;
      }

      await axios.delete(`${API_URL}/admin/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      toast.success('User deleted successfully!');
      fetchUsers();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  // Add an explicit refresh button click handler
  const handleRefreshClick = () => {
    console.log('Manual refresh requested');
    fetchUsers();
  };

  // Filter users based on search term and role filter
  const filteredUsers = users.filter(user => {
    // Don't show admin users in regular user panel
    if (!localStorage.getItem('adminToken') && user.role === 'admin') {
      return false;
    }

    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <div className="flex gap-3">
          <button
            onClick={handleRefreshClick}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            disabled={loading}
          >
            <ArrowPathIconComponent className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <PlusIconComponent className="h-5 w-5 mr-2" />
            Add New User
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <MagnifyingGlassIconComponent className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIconComponent className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            {localStorage.getItem('adminToken') && <option value="admin">Admin</option>}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Online Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.role}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.isOnline 
                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {user.isOnline ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      <PencilIconComponent className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user._id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <TrashIconComponent className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
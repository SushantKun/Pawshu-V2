import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'react-toastify';
import OrderList from '../components/orders/OrderList';

interface Appointment {
  _id: string;
  doctor: {
    _id: string;
    firstName: string;
    lastName: string;
    specialization: string;
    profileImage?: {
      url: string;
    };
  };
  date: string;
  timeSlot: string;
  petName: string;
  petType: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

interface Donation {
  _id: string;
  charityId: string;
  charityName: string;
  amount: number;
  date: string;
  status: string;
}

interface Order {
  _id: string;
  items: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

interface UserProfile {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  address: string;
  avatar: {
    public_id: string;
    url: string;
  };
  role: string;
  createdAt: string;
}

const Profile = () => {
  const { user, loading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [donationsLoading, setDonationsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error' | ''>('');
  const [showNotification, setShowNotification] = useState(false);

  // Helper function to get display name regardless of how it's stored
  const getDisplayName = (profile: UserProfile | null): string => {
    if (!profile) return '';
    
    if (profile.name) {
      return profile.name;
    } else if (profile.firstName && profile.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    } else if (profile.firstName) {
      return profile.firstName;
    } else {
      return profile.email;
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchAppointments();
      fetchDonations();
      fetchOrders();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      setProfile(response.data);
      setEditedProfile(response.data);
      if (response.data.avatar?.url) {
        setImagePreview(response.data.avatar.url);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.response?.data?.message || 'Failed to fetch profile');
    }
  };

  const fetchAppointments = async () => {
    setAppointmentsLoading(true);
    try {
      console.log('Fetching appointments...');
      const response = await api.get('/appointments/my-appointments');
      console.log('Appointments API response:', response.data);
      
      // The API returns { appointments: [...], userType: '...' }
      // Extract the appointments array safely
      let appointmentsData = [];
      if (response.data && response.data.appointments) {
        // API response has the expected structure
        appointmentsData = response.data.appointments;
      } else if (Array.isArray(response.data)) {
        // API directly returns an array
        appointmentsData = response.data;
      }
      
      console.log('Setting appointments state with:', appointmentsData);
      setAppointments(appointmentsData);
      setError('');
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      console.error('Response data:', err.response?.data);
      console.error('Response status:', err.response?.status);
      setError(err.response?.data?.message || 'Failed to fetch appointments');
      // Ensure we set an empty array on error
      setAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const fetchDonations = async () => {
    setDonationsLoading(true);
    try {
      const response = await api.get(`/donations/user/${user?._id}`);
      setDonations(response.data);
    } catch (err: any) {
      console.error('Error fetching donations:', err);
    } finally {
      setDonationsLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await api.get('/orders/user');
      setOrders(response.data);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300';
      case 'completed':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedProfile(prev => prev ? ({
      ...prev,
      [name]: value
    }) : null);
  };

  const showCustomNotification = (message: string, type: 'success' | 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedProfile) return;

    try {
      setSaving(true);
      let avatarData = editedProfile.avatar;

      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        // Upload image through our server
        const uploadResponse = await api.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        avatarData = {
          public_id: uploadResponse.data.public_id,
          url: uploadResponse.data.url
        };
      }

      const response = await api.put('/auth/profile', {
        ...editedProfile,
        avatar: avatarData
      });
      
      setProfile(response.data);
      setIsEditing(false);
      showCustomNotification('Profile information updated successfully!', 'success');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showCustomNotification(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showCustomNotification('Please fill in all password fields', 'error');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showCustomNotification('New passwords do not match', 'error');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      showCustomNotification('New password must be at least 6 characters long', 'error');
      return;
    }
    
    try {
      setSaving(true);
      await api.put('/auth/profile/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      showCustomNotification('Password updated successfully!', 'success');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      console.error('Error updating password:', err);
      showCustomNotification(err.response?.data?.message || 'Failed to update password', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 pt-20">
      {/* Custom Notification */}
      {showNotification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg max-w-md transform transition-all duration-300 ease-in-out ${
          notificationType === 'success' 
            ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 border-l-4 border-green-500' 
            : 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 border-l-4 border-red-500'
        }`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {notificationType === 'success' ? (
                <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notificationMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setShowNotification(false)}
                  className={`inline-flex rounded-md p-1.5 ${
                    notificationType === 'success' 
                      ? 'text-green-600 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-700'
                      : 'text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-700'
                  } focus:outline-none`}
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-8">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
              <div className="relative">
                <img
                  src={imagePreview || profile?.avatar?.url || 'https://placehold.co/150x150'}
                  alt={getDisplayName(profile)}
                  className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-sm"
                />
                <button 
                  onClick={() => {
                    document.getElementById('avatar-upload')?.click();
                  }}
                  className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <input
                  type="file"
                  id="avatar-upload"
                  name="avatar"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setImagePreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                      
                      // Upload immediately
                      try {
                        setSaving(true);
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        // Upload image through server
                        const uploadResponse = await api.post('/upload', formData, {
                          headers: {
                            'Content-Type': 'multipart/form-data'
                          }
                        });
                        
                        const avatarData = {
                          public_id: uploadResponse.data.public_id,
                          url: uploadResponse.data.url
                        };
                        
                        // Update just the avatar
                        const response = await api.put('/auth/profile', {
                          ...profile,
                          avatar: avatarData
                        });
                        
                        setProfile(response.data);
                        showCustomNotification('Profile picture updated successfully!', 'success');
                      } catch (err: any) {
                        console.error('Error updating profile picture:', err);
                        showCustomNotification(err.response?.data?.message || 'Failed to update profile picture', 'error');
                        // Revert preview if upload fails
                        setImagePreview(profile?.avatar?.url || null);
                        setImageFile(null);
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                  className="hidden"
                />
              </div>

              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{getDisplayName(profile)}</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-4">{profile?.email}</p>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</h3>
                    <p className="mt-1 text-gray-900 dark:text-white">{profile?.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</h3>
                    <p className="mt-1 text-gray-900 dark:text-white">{profile?.address || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('profile')}
                className={`${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('appointments')}
                className={`${
                  activeTab === 'appointments'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Appointments
              </button>
              <button
                onClick={() => setActiveTab('donations')}
                className={`${
                  activeTab === 'donations'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Donations
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Orders
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Personal Information</h2>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
                  >
                    {isEditing ? 'Cancel' : 'Edit Profile'}
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 rounded">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="mb-4 p-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 rounded">
                    {success}
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          value={editedProfile?.name || getDisplayName(editedProfile)}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={editedProfile?.email || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Phone
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          id="phone"
                          value={editedProfile?.phone || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Address
                        </label>
                        <input
                          type="text"
                          name="address"
                          id="address"
                          value={editedProfile?.address || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Change Password</h2>
                      <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <div>
                          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Current Password
                          </label>
                          <input
                            type="password"
                            name="currentPassword"
                            id="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordChange}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            New Password
                          </label>
                          <input
                            type="password"
                            name="newPassword"
                            id="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            name="confirmPassword"
                            id="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            {saving ? 'Updating...' : 'Update Password'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</h3>
                        <p className="mt-1 text-gray-900 dark:text-white">{getDisplayName(profile)}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</h3>
                        <p className="mt-1 text-gray-900 dark:text-white">{profile?.email}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</h3>
                        <p className="mt-1 text-gray-900 dark:text-white">{profile?.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</h3>
                        <p className="mt-1 text-gray-900 dark:text-white">{profile?.address || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'appointments' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appointment History</h2>
                {appointmentsLoading ? (
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : !appointments || appointments.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No appointments found.</p>
                ) : (
                  <div className="space-y-4">
                    {appointments.map((appointment) => (
                      <div
                        key={appointment._id}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                              Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {appointment.doctor.specialization}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(appointment.status)}`}>
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                          <p>Date: {new Date(appointment.date).toLocaleDateString()}</p>
                          <p>Time: {appointment.timeSlot}</p>
                          <p>Pet: {appointment.petName} ({appointment.petType})</p>
                          <p>Reason: {appointment.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'donations' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Donation History</h2>
                {donationsLoading ? (
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : donations.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No donations found.</p>
                ) : (
                  <div className="space-y-4">
                    {donations.map((donation) => (
                      <div
                        key={donation._id}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                              {donation.charityName}
                            </h3>
                            <div className="text-gray-600 dark:text-gray-400">
                              NPR {donation.amount.toFixed(2)}
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            donation.status === 'completed'
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300'
                          }`}>
                            {donation.status.charAt(0).toUpperCase() + donation.status.slice(1)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                          <p>Date: {new Date(donation.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Orders</h2>
                </div>
                <OrderList />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 
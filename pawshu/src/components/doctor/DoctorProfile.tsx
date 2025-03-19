import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const PLACEHOLDER_IMAGE = '/placeholder.svg';

interface Doctor {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  specialization: string;
  experience: number;
  bio: string;
  availability: string[];
  profileImage?: {
    url: string;
  };
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  specialization: string;
  experience: number;
  bio: string;
  availability: string[];
  profileImage?: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const DoctorProfile = () => {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    specialization: '',
    experience: 0,
    bio: '',
    availability: [],
    profileImage: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const navigate = useNavigate();

  // Specialization options
  const specializationOptions = [
    'General Veterinarian',
    'Surgery',
    'Dermatology',
    'Cardiology',
    'Neurology',
    'Orthopedics',
    'Dentistry',
    'Ophthalmology',
    'Exotic Animals'
  ];

  // Availability options
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const periods = ['Morning', 'Afternoon'];

  useEffect(() => {
    // Check if doctor is logged in
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      navigate('/doctor/login');
      return;
    }
    
    // Fetch doctor profile
    fetchDoctorProfile();
  }, [navigate]);

  const fetchDoctorProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('doctorToken');
      
      const response = await axios.get(`${API_URL}/doctors/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const doctorData = response.data;
      setDoctor(doctorData);
      
      // Initialize form data
      setFormData({
        firstName: doctorData.firstName || '',
        lastName: doctorData.lastName || '',
        specialization: doctorData.specialization || '',
        experience: doctorData.experience || 0,
        bio: doctorData.bio || '',
        availability: doctorData.availability || [],
        profileImage: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      if (doctorData.profileImage?.url) {
        setImagePreview(doctorData.profileImage.url);
      }
      
      setError('');
    } catch (err: any) {
      console.error('Error fetching doctor profile:', err);
      setError(err.response?.data?.message || 'Failed to fetch profile');
      
      if (err.response?.status === 401) {
        // Unauthorized, redirect to login
        localStorage.removeItem('doctorToken');
        localStorage.removeItem('doctorInfo');
        navigate('/doctor/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleAvailabilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    if (checked) {
      setFormData({
        ...formData,
        availability: [...formData.availability, value]
      });
    } else {
      setFormData({
        ...formData,
        availability: formData.availability.filter(item => item !== value)
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setFormData({
          ...formData,
          profileImage: result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.firstName || !formData.lastName || !formData.specialization) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('doctorToken');
      
      // Prepare data for profile update
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        specialization: formData.specialization,
        experience: formData.experience,
        bio: formData.bio,
        availability: formData.availability
      };
      
      // Add profile image if changed
      if (formData.profileImage) {
        Object.assign(updateData, { profileImage: formData.profileImage });
      }
      
      // Update profile
      await axios.put(`${API_URL}/doctors/profile`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Handle password update if requested
      if (formData.newPassword) {
        // Validate password fields
        if (!formData.currentPassword) {
          setError('Current password is required to set a new password');
          return;
        }
        
        if (formData.newPassword !== formData.confirmPassword) {
          setError('New password and confirmation do not match');
          return;
        }
        
        if (formData.newPassword.length < 6) {
          setError('New password must be at least 6 characters long');
          return;
        }
        
        // Update password
        await axios.put(`${API_URL}/doctors/profile/password`, {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        }, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        setSuccess('Profile and password updated successfully');
      } else {
        setSuccess('Profile updated successfully');
      }
      
      // Reset password fields
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Refresh profile data
      fetchDoctorProfile();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Doctor Profile</h1>
      
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-300 p-4 mb-4">
          <p>{success}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <form onSubmit={handleProfileUpdate} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Specialization
                </label>
                <select
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select Specialization</option>
                  {specializationOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Years of Experience
                </label>
                <input
                  type="number"
                  name="experience"
                  value={formData.experience}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Profile Image</h2>
            
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                <img
                  src={imagePreview || doctor?.profileImage?.url || PLACEHOLDER_IMAGE}
                  alt="Profile"
                  className="h-32 w-32 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Change Profile Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-blue-50 file:text-blue-700
                    dark:file:bg-blue-900/50 dark:file:text-blue-300
                    hover:file:bg-blue-100 dark:hover:file:bg-blue-900/70"
                />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Availability</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {daysOfWeek.map(day => (
                <div key={day}>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{day}</h3>
                  <div className="space-y-2">
                    {periods.map(period => (
                      <label key={`${day}-${period}`} className="flex items-center">
                        <input
                          type="checkbox"
                          value={`${day}-${period}`}
                          checked={formData.availability.includes(`${day}-${period}`)}
                          onChange={handleAvailabilityChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">{period}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Change Password</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default DoctorProfile; 
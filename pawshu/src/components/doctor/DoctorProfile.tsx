import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
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
  isActive: boolean;
  locationPreference: 'clinic' | 'home_visit' | 'both';
  clinicAddress?: string;
  appointmentDuration: number;
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
  isActive: boolean;
  locationPreference: 'clinic' | 'home_visit' | 'both';
  clinicAddress?: string;
  appointmentDuration: number;
  profileImage?: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Interface for custom time slot
interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
  id: string;
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
    isActive: true,
    locationPreference: 'clinic',
    clinicAddress: '',
    appointmentDuration: 30,
    profileImage: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [customTimeSlots, setCustomTimeSlots] = useState<TimeSlot[]>([]);
  const [newSlot, setNewSlot] = useState<{
    day: string;
    startTime: string;
    endTime: string;
  }>({
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00'
  });
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

  useEffect(() => {
    // Convert availability strings to custom time slots
    if (formData.availability && formData.availability.length > 0) {
      const slots: TimeSlot[] = [];
      formData.availability.forEach(availability => {
        const parts = availability.split(' ');
        if (parts.length >= 2) {
          const day = parts[0];
          const timeRange = parts[1];
          const [timeStart, timeEnd] = timeRange.split('-');
          
          if (timeStart && timeEnd) {
            slots.push({
              day,
              startTime: `${timeStart.padStart(2, '0')}:00`,
              endTime: `${timeEnd.padStart(2, '0')}:00`,
              id: `${day}-${timeStart}-${timeEnd}`
            });
          }
        }
      });
      setCustomTimeSlots(slots);
    }
  }, [formData.availability]);

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
      
      // Initialize form data with new fields
      setFormData({
        firstName: doctorData.firstName || '',
        lastName: doctorData.lastName || '',
        specialization: doctorData.specialization || '',
        experience: doctorData.experience || 0,
        bio: doctorData.bio || '',
        availability: doctorData.availability || [],
        isActive: doctorData.isActive !== undefined ? doctorData.isActive : true,
        locationPreference: doctorData.locationPreference || 'clinic',
        clinicAddress: doctorData.clinicAddress || '',
        appointmentDuration: doctorData.appointmentDuration || 30,
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

  const handleTimeSlotAdd = () => {
    const { day, startTime, endTime } = newSlot;
    
    // Format times for storage - extract only the hour part from HH:MM format
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    
    // Validate time range
    if (startHour >= endHour) {
      setError('End time must be after start time');
      return;
    }
    
    // Create a slot ID
    const slotId = `${day}-${startHour}-${endHour}`;
    
    // Check if this slot already exists
    if (customTimeSlots.some(slot => slot.id === slotId)) {
      setError('This time slot already exists');
      return;
    }
    
    // Add to custom slots - keep the original time with minutes for display
    setCustomTimeSlots([
      ...customTimeSlots,
      {
        day,
        startTime,
        endTime,
        id: slotId
      }
    ]);
    
    // Add to availability in the required format - use clean hours WITHOUT any minutes
    const availabilityValue = `${day} ${startHour}-${endHour}`;
    console.log('Adding availability value:', availabilityValue);
    
    if (!formData.availability.includes(availabilityValue)) {
      setFormData({
        ...formData,
        availability: [...formData.availability, availabilityValue]
      });
    }
    
    // Reset the error if there was one
    setError('');
  };

  const handleTimeSlotDelete = (slotId: string) => {
    // Remove from custom slots
    const updatedSlots = customTimeSlots.filter(slot => slot.id !== slotId);
    setCustomTimeSlots(updatedSlots);
    
    // Get the slot that's being deleted
    const slotToDelete = customTimeSlots.find(slot => slot.id === slotId);
    if (slotToDelete) {
      // Extract the components to create the availability value
      const startHour = parseInt(slotToDelete.startTime.split(':')[0]);
      const endHour = parseInt(slotToDelete.endTime.split(':')[0]);
      const availabilityValue = `${slotToDelete.day} ${startHour}-${endHour}`;
      
      // Remove from availability
      setFormData({
        ...formData,
        availability: formData.availability.filter(item => item !== availabilityValue)
      });
    }
  };

  const handleNewSlotChange = (field: 'day' | 'startTime' | 'endTime', value: string) => {
    setNewSlot({
      ...newSlot,
      [field]: value
    });
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

  const fetchDefaultTimeSlots = async () => {
    try {
      setLoadingTimeSlots(true);
      
      // Generate default time slots based on standard business hours
      const defaultTimeSlots: TimeSlot[] = [];
      const defaultHours = [
        { start: 9, end: 12 },  // Morning hours
        { start: 13, end: 17 }  // Afternoon hours
      ];
      
      // Only add default slots for weekdays
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      weekdays.forEach(day => {
        defaultHours.forEach(hour => {
          const slotId = `${day}-${hour.start}-${hour.end}`;
          defaultTimeSlots.push({
            day,
            startTime: `${hour.start.toString().padStart(2, '0')}:00`,
            endTime: `${hour.end.toString().padStart(2, '0')}:00`,
            id: slotId
          });
          
          // Add to availability in the required format if not already there
          const availabilityValue = `${day} ${hour.start}-${hour.end}`;
          if (!formData.availability.includes(availabilityValue)) {
            formData.availability.push(availabilityValue);
          }
        });
      });
      
      // Update the custom time slots
      setCustomTimeSlots(prevSlots => {
        // Filter out any slots that would be duplicates
        const existingIds = prevSlots.map(slot => slot.id);
        const newSlots = defaultTimeSlots.filter(slot => !existingIds.includes(slot.id));
        return [...prevSlots, ...newSlots];
      });
      
      // Update form data
      setFormData({
        ...formData,
        availability: [...formData.availability]
      });
      
      setError('');
    } catch (err: any) {
      console.error('Error setting default time slots:', err);
      setError('Failed to set default time slots');
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  const toggleActiveStatus = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('doctorToken');
      const newStatus = !formData.isActive;
      
      const response = await axios.put(`${API_URL}/doctors/active-status`, 
        { isActive: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Toggle status response:', response.data);
      
      setFormData({
        ...formData,
        isActive: newStatus
      });
      
      setSuccess(`You are now ${newStatus ? 'active' : 'inactive'} and ${newStatus ? 'will' : 'will not'} receive new appointments`);
    } catch (err: any) {
      console.error('Error toggling active status:', err);
      setError(err.response?.data?.message || 'Failed to update active status. Make sure your server is running.');
    } finally {
      setSaving(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.firstName || !formData.lastName || !formData.specialization) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Validate clinic address if clinic location is selected
    if ((formData.locationPreference === 'clinic' || formData.locationPreference === 'both') && !formData.clinicAddress) {
      setError('Please provide your clinic address');
      return;
    }
    
    // Ensure at least one availability slot
    if (formData.availability.length === 0) {
      setError('Please select at least one availability time slot');
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('doctorToken');
      
      // Prepare data for profile update with new fields
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        specialization: formData.specialization,
        experience: formData.experience,
        bio: formData.bio,
        availability: formData.availability,
        locationPreference: formData.locationPreference,
        clinicAddress: formData.clinicAddress,
        appointmentDuration: formData.appointmentDuration
      };
      
      // Add profile image if changed
      if (formData.profileImage) {
        Object.assign(updateData, { profileImage: formData.profileImage });
      }
      
      console.log('Updating profile with data:', updateData);
      
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
          setSaving(false);
          return;
        }
        
        if (formData.newPassword !== formData.confirmPassword) {
          setError('New password and confirmation do not match');
          setSaving(false);
          return;
        }
        
        if (formData.newPassword.length < 6) {
          setError('New password must be at least 6 characters long');
          setSaving(false);
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
        
        setSuccess('Profile, availability, and password updated successfully');
      } else {
        setSuccess('Profile and availability updated successfully');
      }
      
      // Reset password fields
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Refresh doctor profile
      fetchDoctorProfile();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile. Make sure your server is running.');
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
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Account Status</h2>
            
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.isActive 
                      ? 'You are currently ACTIVE and available for appointments' 
                      : 'You are currently INACTIVE and not accepting appointments'}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={toggleActiveStatus}
                    disabled={saving}
                    className={`px-4 py-2 rounded text-white ${
                      formData.isActive 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {saving ? 'Updating...' : formData.isActive ? 'Set Inactive' : 'Set Active'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Appointment Settings</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Appointment Duration (minutes)
              </label>
              <select
                name="appointmentDuration"
                value={formData.appointmentDuration}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location Preference
              </label>
              <select
                name="locationPreference"
                value={formData.locationPreference}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="clinic">Clinic Only</option>
                <option value="home_visit">Home Visits Only</option>
                <option value="both">Both Clinic & Home Visits</option>
              </select>
            </div>
            
            {(formData.locationPreference === 'clinic' || formData.locationPreference === 'both') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Clinic Address
                </label>
                <textarea
                  name="clinicAddress"
                  value={formData.clinicAddress || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Enter your clinic address"
                ></textarea>
              </div>
            )}
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Availability</h2>
            
            <div className="mb-6">
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Day
                  </label>
                  <select
                    value={newSlot.day}
                    onChange={(e) => handleNewSlotChange('day', e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    {daysOfWeek.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newSlot.startTime}
                    onChange={(e) => handleNewSlotChange('startTime', e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newSlot.endTime}
                    onChange={(e) => handleNewSlotChange('endTime', e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={handleTimeSlotAdd}
                  className="flex items-center justify-center p-2 bg-green-500 text-white rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Selected Time Slots</h3>
                
                {customTimeSlots.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No time slots added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {daysOfWeek.map(day => {
                      const daySlots = customTimeSlots.filter(slot => slot.day === day);
                      
                      if (daySlots.length === 0) return null;
                      
                      return (
                        <div key={day} className="border rounded-md p-3 dark:border-gray-700">
                          <h4 className="font-medium mb-2 text-gray-900 dark:text-white">{day}</h4>
                          <div className="space-y-2">
                            {daySlots.map(slot => (
                              <div key={slot.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                <span className="text-gray-800 dark:text-gray-200">
                                  {slot.startTime} - {slot.endTime}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleTimeSlotDelete(slot.id)}
                                  className="text-red-500 hover:text-red-700 focus:outline-none"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
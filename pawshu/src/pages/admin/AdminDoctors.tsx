import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

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

interface DoctorFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  specialization: string;
  experience: number;
  bio: string;
  availability: string[];
  profileImage?: string;
}

// Add TimeSlot interface
interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
  id: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const AdminDoctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [formData, setFormData] = useState<DoctorFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    specialization: '',
    experience: 0,
    bio: '',
    availability: [],
    profileImage: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
    fetchDoctors();
  }, []);

  // Add this effect to convert availability to custom time slots
  useEffect(() => {
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
    } else {
      setCustomTimeSlots([]);
    }
  }, [formData.availability]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        setError('Admin authentication required');
        setLoading(false);
        // Redirect to admin login
        window.location.href = '/admin/login';
        return;
      }

      console.log('Fetching doctors with token:', token ? 'Token present' : 'No token');
      const response = await axios.get(`${API_URL}/admin/doctors`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data) {
        console.log('Doctors fetched successfully:', response.data.length);
        setDoctors(response.data);
        setError('');
      } else {
        console.error('No data received from server');
        setError('No data received from server');
      }
    } catch (err: any) {
      console.error('Error fetching doctors:', err);
      if (err.response?.status === 401) {
        setError('Admin authentication required. Please log in again.');
        // Clear invalid token
        localStorage.removeItem('adminToken');
        // Redirect to admin login
        window.location.href = '/admin/login';
      } else {
        setError('Failed to fetch doctors. Please try again.');
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
      console.log('Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size should be less than 2MB');
        return;
      }
      
      // Create an image element to resize the image
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        
        img.onload = () => {
          // Create a canvas to resize the image
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions (max 800px width/height)
          const maxSize = 800;
          if (width > height && width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw resized image on canvas
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Get resized image as data URL
          const resizedImage = canvas.toDataURL(file.type, 0.8); // 0.8 quality
          
          console.log('Resized image size (approx):', Math.round(resizedImage.length / 1.37 / 1024), 'KB');
          
          setImagePreview(resizedImage);
          setFormData({
            ...formData,
            profileImage: resizedImage
          });
        };
      };
      
      reader.onerror = () => {
        console.error('Error reading file');
        toast.error('Error reading file. Please try again.');
      };
      
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      specialization: '',
      experience: 0,
      bio: '',
      availability: [],
      profileImage: ''
    });
    setSelectedDoctor(null);
    setImagePreview(null);
    setError('');
    setCustomTimeSlots([]);
    setNewSlot({
      day: 'Monday',
      startTime: '09:00',
      endTime: '10:00'
    });
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || 
        !formData.specialization || formData.experience <= 0 || !formData.bio) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    // Ensure the doctor has at least one availability slot
    if (!formData.availability.length) {
      setError('Please select at least one availability time slot');
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      // Debug check availability format
      console.log('Current availability format before formatting:', formData.availability);
      
      // Ensure time slots are in correct format (Day StartHour-EndHour)
      const formattedAvailability = formData.availability.map(slot => {
        const parts = slot.split(' ');
        if (parts.length >= 2) {
          const day = parts[0];
          const timeRange = parts[1];
          const [startTime, endTime] = timeRange.split('-');
          
          const startHour = parseInt(startTime);
          const endHour = parseInt(endTime);
          
          if (!isNaN(startHour) && !isNaN(endHour)) {
            // Return clean format without any minutes
            return `${day} ${startHour}-${endHour}`;
          }
        }
        return slot; // Return original if can't parse
      });
      
      // Create submission data with formatted availability
      const submissionData = {
        ...formData,
        availability: formattedAvailability
      };
      
      console.log('Adding doctor with data:', {
        ...submissionData,
        profileImage: submissionData.profileImage ? 'Image data included' : 'No image',
        availability: submissionData.availability
      });
      
      const response = await axios.post(`${API_URL}/admin/doctors`, submissionData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Add doctor response:', response.data);
      toast.success('Doctor added successfully!');
      setShowAddModal(false);
      resetForm();
      fetchDoctors();
    } catch (err: any) {
      console.error('Error adding doctor:', err);
      const errorMessage = err.response?.data?.message || 'Failed to add doctor. Make sure your server is running.';
      
      // Show more details for availability errors
      if (errorMessage.includes('time range') || errorMessage.includes('availability')) {
        console.error('Availability error details:', err.response?.data);
        toast.error(`${errorMessage}. Check console for details.`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setFormData({
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.email,
      password: '', // Password is not included in the edit form
      specialization: doctor.specialization,
      experience: doctor.experience,
      bio: doctor.bio,
      availability: doctor.availability,
      profileImage: doctor.profileImage?.url || ''
    });
    
    // Convert availability strings to custom time slots
    if (doctor.availability && doctor.availability.length > 0) {
      const slots: TimeSlot[] = [];
      doctor.availability.forEach(availability => {
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
    } else {
      setCustomTimeSlots([]);
    }
    
    setImagePreview(doctor.profileImage?.url || null);
    setShowEditModal(true);
  };

  const handleUpdateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDoctor) {
      setError('No doctor selected for update');
      return;
    }
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.specialization || formData.experience <= 0 || !formData.bio) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Ensure the doctor has at least one availability slot
    if (!formData.availability.length) {
      setError('Please select at least one availability time slot');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      // Debug check availability format
      console.log('Current availability format:', formData.availability);
      
      // Ensure time slots are in correct format (Day StartHour-EndHour)
      const formattedAvailability = formData.availability.map(slot => {
        const parts = slot.split(' ');
        if (parts.length >= 2) {
          const day = parts[0];
          const timeRange = parts[1];
          const [startTime, endTime] = timeRange.split('-');
          
          const startHour = parseInt(startTime);
          const endHour = parseInt(endTime);
          
          if (!isNaN(startHour) && !isNaN(endHour)) {
            // Return clean format without any minutes
            return `${day} ${startHour}-${endHour}`;
          }
        }
        return slot; // Return original if can't parse
      });
      
      // Prepare data for update - strip any unused fields for clarity
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        specialization: formData.specialization,
        experience: formData.experience,
        bio: formData.bio,
        availability: formattedAvailability
      };
      
      // Only include password if it's provided
      if (formData.password) {
        Object.assign(updateData, { password: formData.password });
      }
      
      // Only include profileImage if it's been updated
      if (formData.profileImage && formData.profileImage.startsWith('data:')) {
        Object.assign(updateData, { profileImage: formData.profileImage });
      }
      
      console.log('Updating doctor with data:', {
        ...updateData,
        profileImage: formData.profileImage ? (formData.profileImage.startsWith('data:') ? 'New image data included' : 'Using existing image') : 'No image',
        availability: updateData.availability // Log formatted availability
      });
      
      await axios.put(`${API_URL}/admin/doctors/${selectedDoctor._id}`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Doctor updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchDoctors();
    } catch (err: any) {
      console.error('Error updating doctor:', err);
      const errorMessage = err.response?.data?.message || 'Failed to update doctor. Make sure your server is running.';
      
      // Show more details for availability errors if present
      if (errorMessage.includes('time range') || errorMessage.includes('availability')) {
        console.error('Availability error details:', err.response?.data);
        toast.error(`${errorMessage}. Check console for details.`);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoctor = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this doctor?')) {
      try {
        setLoading(true);
        const token = localStorage.getItem('adminToken');
        await axios.delete(`${API_URL}/admin/doctors/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        toast.success('Doctor deleted successfully!');
        fetchDoctors();
      } catch (err: any) {
        console.error('Error deleting doctor:', err);
        toast.error(err.response?.data?.message || 'Failed to delete doctor. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Add new functions for time slot management
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
    // Format should be "Day startHour-endHour" e.g. "Monday 9-17"
    const availabilityValue = `${day} ${startHour}-${endHour}`;
    console.log('Adding availability value:', availabilityValue);
    
    if (!formData.availability.includes(availabilityValue)) {
      setFormData({
        ...formData,
        availability: [...formData.availability, availabilityValue]
      });
    }
    
    // Reset any error
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
      
      // Format should be "Day startHour-endHour" e.g. "Monday 9-17"
      const availabilityValue = `${slotToDelete.day} ${startHour}-${endHour}`;
      console.log('Removing availability value:', availabilityValue);
      
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

  return (
    <div className="container mx-auto px-4 py-8">
      <ToastContainer />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Doctors</h1>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add New Doctor
        </button>
      </div>

      {error && <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded-lg mb-6">{error}</div>}

      {loading && !showAddModal && !showEditModal ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Specialization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Experience
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {doctors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No doctors found. Add a new doctor to get started.
                  </td>
                </tr>
              ) : (
                doctors.map((doctor) => (
                  <tr key={doctor._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {doctor.profileImage ? (
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={doctor.profileImage.url}
                              alt={`${doctor.firstName} ${doctor.lastName}`}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-gray-600 dark:text-gray-300">
                                {doctor.firstName.charAt(0)}
                                {doctor.lastName.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {doctor.firstName} {doctor.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {doctor.specialization}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {doctor.experience} years
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {doctor.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditClick(doctor)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDoctor(doctor._id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Add New Doctor</h2>
            <form onSubmit={handleAddDoctor}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Specialization</label>
                  <select
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Select Specialization</option>
                    {specializationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Experience (years)</label>
                  <input
                    type="number"
                    name="experience"
                    value={formData.experience}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                ></textarea>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Availability</label>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
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
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
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
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
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
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selected Time Slots</h3>
                  
                  {customTimeSlots.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No time slots added yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {daysOfWeek.map(day => {
                        const daySlots = customTimeSlots.filter(slot => slot.day === day);
                        
                        if (daySlots.length === 0) return null;
                        
                        return (
                          <div key={day} className="border rounded-md p-3 dark:border-gray-700">
                            <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{day}</h4>
                            <div className="space-y-2">
                              {daySlots.map(slot => (
                                <div key={slot.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                  <span className="text-sm text-gray-800 dark:text-gray-200">
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleTimeSlotDelete(slot.id)}
                                    className="text-red-500 hover:text-red-700 focus:outline-none"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Profile Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Profile Preview"
                      className="h-32 w-32 object-cover rounded-md"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Doctor Modal */}
      {showEditModal && selectedDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Doctor</h2>
            <form onSubmit={handleUpdateDoctor}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Specialization</label>
                  <select
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Select Specialization</option>
                    {specializationOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-2">Experience (years)</label>
                  <input
                    type="number"
                    name="experience"
                    value={formData.experience}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                ></textarea>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Availability</label>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
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
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
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
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
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
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selected Time Slots</h3>
                  
                  {customTimeSlots.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No time slots added yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {daysOfWeek.map(day => {
                        const daySlots = customTimeSlots.filter(slot => slot.day === day);
                        
                        if (daySlots.length === 0) return null;
                        
                        return (
                          <div key={day} className="border rounded-md p-3 dark:border-gray-700">
                            <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{day}</h4>
                            <div className="space-y-2">
                              {daySlots.map(slot => (
                                <div key={slot.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                  <span className="text-sm text-gray-800 dark:text-gray-200">
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleTimeSlotDelete(slot.id)}
                                    className="text-red-500 hover:text-red-700 focus:outline-none"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              <div className="mb-4">
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Profile Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Profile Preview"
                      className="h-32 w-32 object-cover rounded-md"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDoctors; 
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import LostFoundCard from '../components/LostFoundCard';

// Create axios instance with base URL and default headers
const api = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
  matches?: Array<{
    reportId: string;
    status: 'pending' | 'confirmed' | 'rejected';
  }>;
}

interface FormData {
  type: 'lost' | 'found';
  petType: string;
  breed: string;
  location: string;
  date: string;
  description: string;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  additionalDetails: {
    color: string;
    size: string;
    age: string;
    gender: string;
    microchipped: boolean;
    collar: boolean;
    distinctiveFeatures: string;
  };
}

type ReportDataWithoutImages = Omit<FormData, 'images'>;

interface ReportData extends ReportDataWithoutImages {
  images: Array<{ url: string }>;
}

const LostFound = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'browse' | 'report'>('browse');
  const [filter, setFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [reports, setReports] = useState<PetReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({
    type: 'lost',
    petType: '',
    breed: '',
    location: '',
    date: '',
    description: '',
    contact: {
      name: user?.name || '',
      email: user?.email || '',
      phone: ''
    },
    additionalDetails: {
      color: '',
      size: '',
      age: '',
      gender: '',
      microchipped: false,
      collar: false,
      distinctiveFeatures: ''
    }
  });

  const fetchReports = async () => {
    try {
      const response = await api.get('/api/lost-found');
      setReports(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to fetch reports');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length + selectedImages.length > 5) {
        toast.error('Maximum 5 images allowed');
        return;
      }
      setSelectedImages(prevImages => [...prevImages, ...files]);

      const newImageUrls = files.map(file => URL.createObjectURL(file));
      setImagePreviewUrls(prevUrls => [...prevUrls, ...newImageUrls]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to submit a report');
      return;
    }

    try {
      const imagePromises = selectedImages.map(async (file) => {
        const reader = new FileReader();
        return new Promise<string>((resolve) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(imagePromises);
      const reportData = {
        type: formData.type,
        petType: formData.petType,
        breed: formData.breed,
        location: formData.location,
        date: formData.date,
        description: formData.description,
        contact: formData.contact,
        additionalDetails: formData.additionalDetails,
        images: base64Images.map(base64 => ({ url: base64 }))
      };

      await api.post('/api/lost-found', reportData);
      toast.success('Report submitted successfully');
      setActiveTab('browse');
      fetchReports();
      
      // Reset form
      setFormData({
        type: 'lost',
        petType: '',
        breed: '',
        location: '',
        date: '',
        description: '',
        contact: {
          name: user.name || '',
          email: user.email || '',
          phone: ''
        },
        additionalDetails: {
          color: '',
          size: '',
          age: '',
          gender: '',
          microchipped: false,
          collar: false,
          distinctiveFeatures: ''
        }
      });
      setSelectedImages([]);
      setImagePreviewUrls([]);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checkboxValue = isCheckbox ? (e.target as HTMLInputElement).checked : false;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      
      if (section === 'contact') {
        setFormData({
          type: formData.type,
          petType: formData.petType,
          breed: formData.breed,
          location: formData.location,
          date: formData.date,
          description: formData.description,
          contact: {
            name: field === 'name' ? value : formData.contact.name,
            email: field === 'email' ? value : formData.contact.email,
            phone: field === 'phone' ? value : formData.contact.phone
          },
          additionalDetails: formData.additionalDetails
        });
      } else if (section === 'additionalDetails') {
        setFormData({
          type: formData.type,
          petType: formData.petType,
          breed: formData.breed,
          location: formData.location,
          date: formData.date,
          description: formData.description,
          contact: formData.contact,
          additionalDetails: {
            color: field === 'color' ? value : formData.additionalDetails.color,
            size: field === 'size' ? value : formData.additionalDetails.size,
            age: field === 'age' ? value : formData.additionalDetails.age,
            gender: field === 'gender' ? value : formData.additionalDetails.gender,
            microchipped: field === 'microchipped' ? checkboxValue : formData.additionalDetails.microchipped,
            collar: field === 'collar' ? checkboxValue : formData.additionalDetails.collar,
            distinctiveFeatures: field === 'distinctiveFeatures' ? value : formData.additionalDetails.distinctiveFeatures
          }
        });
      }
    } else {
      // For top-level fields
      const newFormData = {
        type: name === 'type' ? value as 'lost' | 'found' : formData.type,
        petType: name === 'petType' ? value : formData.petType,
        breed: name === 'breed' ? value : formData.breed,
        location: name === 'location' ? value : formData.location,
        date: name === 'date' ? value : formData.date,
        description: name === 'description' ? value : formData.description,
        contact: formData.contact,
        additionalDetails: formData.additionalDetails
      };
      
      setFormData(newFormData);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lost & Found Pets</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Help reunite lost pets with their families</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-6 py-2 ${
                activeTab === 'browse'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Browse Reports
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-6 py-2 ${
                activeTab === 'report'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Submit Report
            </button>
          </div>
        </div>

        {activeTab === 'browse' ? (
          <>
            {/* Search and Filters */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex-1 w-full sm:max-w-md">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search reports..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-md ${
                      filter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter('lost')}
                    className={`px-4 py-2 rounded-md ${
                      filter === 'lost'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Lost Pets
                  </button>
                  <button
                    onClick={() => setFilter('found')}
                    className={`px-4 py-2 rounded-md ${
                      filter === 'found'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    Found Pets
                  </button>
                </div>
              </div>
            </div>

            {/* Reports Grid */}
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports
                  .filter(report => {
                    // Apply type filter
                    if (filter !== 'all' && report.type !== filter) {
                      return false;
                    }
                    
                    // Apply search filter
                    if (searchQuery) {
                      const query = searchQuery.toLowerCase();
                      return (
                        report.petType.toLowerCase().includes(query) ||
                        (report.breed && report.breed.toLowerCase().includes(query)) ||
                        report.location.toLowerCase().includes(query) ||
                        report.description.toLowerCase().includes(query)
                      );
                    }
                    
                    return true;
                  })
                  .map(report => (
                    <LostFoundCard 
                      key={report._id} 
                      report={report} 
                      onStatusChange={fetchReports} 
                    />
                  ))}
              </div>
            )}
            
            {reports.length === 0 && !loading && (
              <div className="text-center py-10">
                <p className="text-gray-500 dark:text-gray-400">No reports found</p>
              </div>
            )}
            
            {reports.filter(report => {
              if (filter !== 'all' && report.type !== filter) {
                return false;
              }
              
              if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                  report.petType.toLowerCase().includes(query) ||
                  (report.breed && report.breed.toLowerCase().includes(query)) ||
                  report.location.toLowerCase().includes(query) ||
                  report.description.toLowerCase().includes(query)
                );
              }
              
              return true;
            }).length === 0 && reports.length > 0 && !loading && (
              <div className="text-center py-10">
                <p className="text-gray-500 dark:text-gray-400">No reports match your filters</p>
              </div>
            )}
          </>
        ) : (
          /* Report Form */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Report Type
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="lost">Lost Pet</option>
                    <option value="found">Found Pet</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pet Type
                    </label>
                    <input
                      type="text"
                      name="petType"
                      value={formData.petType}
                      onChange={handleChange}
                      placeholder="e.g., Dog, Cat, Bird"
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Breed (optional)
                    </label>
                    <input
                      type="text"
                      name="breed"
                      value={formData.breed}
                      onChange={handleChange}
                      placeholder="e.g., Golden Retriever"
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Enter the location where the pet was lost/found"
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Provide details about the pet's appearance, behavior, or circumstances"
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                {/* Additional Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Additional Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Color
                      </label>
                      <input
                        type="text"
                        name="additionalDetails.color"
                        value={formData.additionalDetails.color}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Size
                      </label>
                      <select
                        name="additionalDetails.size"
                        value={formData.additionalDetails.size}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Select size</option>
                        <option value="Small">Small</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Age (if known)
                      </label>
                      <input
                        type="text"
                        name="additionalDetails.age"
                        value={formData.additionalDetails.age}
                        onChange={handleChange}
                        placeholder="e.g., 2 years"
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Gender
                      </label>
                      <select
                        name="additionalDetails.gender"
                        value={formData.additionalDetails.gender}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Unknown</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="additionalDetails.microchipped"
                        checked={formData.additionalDetails.microchipped}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Microchipped</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="additionalDetails.collar"
                        checked={formData.additionalDetails.collar}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Wearing Collar</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Distinctive Features
                    </label>
                    <textarea
                      name="additionalDetails.distinctiveFeatures"
                      value={formData.additionalDetails.distinctiveFeatures}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Any unique markings, scars, or identifying features"
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contact Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        name="contact.name"
                        value={formData.contact.name}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        name="contact.email"
                        value={formData.contact.email}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Phone (optional)
                      </label>
                      <input
                        type="tel"
                        name="contact.phone"
                        value={formData.contact.phone}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Images (up to 5)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="flex text-sm text-gray-600 dark:text-gray-400">
                        <label htmlFor="images" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                          <span>Upload images</span>
                          <input
                            id="images"
                            name="images"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="sr-only"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PNG, JPG, GIF up to 10MB each
                      </p>
                    </div>
                  </div>
                  {imagePreviewUrls.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {imagePreviewUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="h-24 w-full object-cover rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                            className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 focus:outline-none"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LostFound; 
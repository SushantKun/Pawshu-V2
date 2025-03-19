import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { PhotoIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const PhotoIconComponent = PhotoIcon as IconComponent;

const API_URL = 'http://localhost:5000/api';
const PLACEHOLDER_IMAGE = '/placeholder.jpg';

interface Charity {
  _id: string;
  name: string;
  description: string;
  image: {
    public_id: string;
    url: string;
  };
  goal: number;
  raised: number;
  updatedAt: string;
}

interface CharityFormData {
  name: string;
  description: string;
  goal: number;
}

const CharityManagement = () => {
  const [charities, setCharities] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CharityFormData>({
    name: '',
    description: '',
    goal: 0
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchCharities();
  }, []);

  const getAuthHeader = () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('You are not logged in. Please log in as an admin.');
      setTimeout(() => {
        navigate('/admin/login');
      }, 2000);
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  };

  const fetchCharities = async () => {
    try {
      const headers = getAuthHeader();
      if (!headers) return;

      console.log('Fetching charities with auth headers:', headers);
      const response = await axios.get(`${API_URL}/admin/charities`, {
        headers
      });
      setCharities(response.data);
    } catch (error) {
      console.error('Failed to fetch charities:', error);
      toast.error('Failed to fetch charities');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'goal' ? Number(value) : value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type and size
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB max
      
      if (!isValidType) {
        toast.error('Please select a valid image file');
        return;
      }
      
      if (!isValidSize) {
        toast.error('Image must be less than 5MB');
        return;
      }
      
      setSelectedImage(file);
      const previewURL = URL.createObjectURL(file);
      setPreviewImage(previewURL);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      goal: 0
    });
    setIsEditing(false);
    setEditingId(null);
    setShowForm(false);
    setSelectedImage(null);
    setPreviewImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const headers = getAuthHeader();
      if (!headers) return;
      
      // Prepare form data
      let imageData = null;
      
      if (selectedImage) {
        // Convert image to base64
        imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(selectedImage);
          reader.onload = () => {
            const result = reader.result as string;
            if (result && result.startsWith('data:image/')) {
              resolve(result);
            } else {
              reject(new Error('Invalid image data'));
            }
          };
          reader.onerror = error => {
            reject(error);
          };
        });
      }
      
      if (isEditing && editingId) {
        // Create charity data object based on whether an image was selected
        const charityData = selectedImage
          ? {
              name: formData.name,
              description: formData.description,
              goal: formData.goal,
              image: imageData
            }
          : {
              name: formData.name,
              description: formData.description,
              goal: formData.goal
            };
        
        await axios.put(`${API_URL}/admin/charities/${editingId}`, charityData, {
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
        toast.success('Charity updated successfully');
      } else {
        // For new charities, image is required
        if (!imageData) {
          toast.error('Please select an image');
          setLoading(false);
          return;
        }
        
        const charityData = {
          name: formData.name,
          description: formData.description,
          goal: formData.goal,
          image: imageData
        };
        
        await axios.post(`${API_URL}/admin/charities`, charityData, {
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
        toast.success('Charity created successfully');
      }
      
      fetchCharities();
      resetForm();
    } catch (error) {
      console.error('Error saving charity:', error);
      toast.error(isEditing ? 'Failed to update charity' : 'Failed to create charity');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (charity: Charity) => {
    setFormData({
      name: charity.name,
      description: charity.description,
      goal: charity.goal
    });
    setEditingId(charity._id);
    setIsEditing(true);
    setShowForm(true);
    
    // If charity has an image, set it as preview but don't set a selectedImage
    if (charity.image && charity.image.url) {
      setPreviewImage(charity.image.url);
    } else {
      setPreviewImage(null);
    }
    setSelectedImage(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this charity?')) {
      try {
        const headers = getAuthHeader();
        if (!headers) return;
        
        await axios.delete(`${API_URL}/admin/charities/${id}`, { headers });
        toast.success('Charity deleted successfully');
        fetchCharities();
      } catch (error) {
        console.error('Failed to delete charity:', error);
        toast.error('Failed to delete charity');
      }
    }
  };

  const getCharityImage = (charity: Charity): string => {
    if (charity.image && charity.image.url && !imageErrors[charity._id]) {
      return charity.image.url;
    }
    return PLACEHOLDER_IMAGE;
  };

  const handleImageError = (charityId: string) => {
    setImageErrors(prev => ({
      ...prev,
      [charityId]: true
    }));
  };

  if (loading && charities.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Charity Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {showForm ? 'Close Form' : 'Add New Charity'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Goal Amount (NPR)</label>
              <input
                type="number"
                name="goal"
                value={formData.goal}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Charity Image
              </label>
              
              <div className="mt-1 flex items-center">
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center"
                >
                  <PhotoIconComponent className="h-5 w-5 mr-2" />
                  {isEditing ? 'Change Image' : 'Add Image'}
                </label>
                <input
                  id="image-upload"
                  name="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </div>
              
              {/* Preview of the image */}
              {previewImage && (
                <div className="mt-4">
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="h-48 w-48 object-cover rounded-md"
                  />
                  {selectedImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setPreviewImage(null);
                      }}
                      className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              )}
              
              {isEditing && !selectedImage && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {previewImage ? 'Using existing image. Upload a new one to replace it.' : 'No image currently. Please upload one.'}
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  isEditing ? 'Update Charity' : 'Create Charity'
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {charities.length === 0 ? (
          <div className="col-span-3 text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <p className="text-gray-500 dark:text-gray-400">No charities found. Add your first charity!</p>
          </div>
        ) : (
          charities.map((charity) => (
            <div key={charity._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <img
                src={getCharityImage(charity)}
                alt={charity.name}
                className="w-full h-48 object-cover"
                onError={() => handleImageError(charity._id)}
              />
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{charity.name}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">{charity.description}</p>
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{Math.round((charity.raised / charity.goal) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (charity.raised / charity.goal) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm mt-1 text-gray-900 dark:text-white">
                    <span>NPR {charity.raised.toLocaleString()}</span>
                    <span>NPR {charity.goal.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => handleEdit(charity)}
                    className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(charity._id)}
                    className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CharityManagement; 
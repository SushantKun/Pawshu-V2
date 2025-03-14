import { useState, useEffect, useCallback } from 'react';
import { PencilIcon, TrashIcon, PlusIcon, PhotoIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const PencilIconComponent = PencilIcon as IconComponent;
const TrashIconComponent = TrashIcon as IconComponent;
const PlusIconComponent = PlusIcon as IconComponent;
const PhotoIconComponent = PhotoIcon as IconComponent;

interface ProductImage {
  public_id: string;
  url: string;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  category: string;
  images: ProductImage[];
  description: string;
  stock: number;
  featured: boolean;
}

const API_URL = 'http://localhost:5000/api';
const PLACEHOLDER_IMAGE = '/placeholder.jpg';

const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'Food',
    description: '',
    stock: '',
    featured: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const getAuthHeader = () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setError('You are not logged in. Please log in as an admin.');
      setTimeout(() => {
        navigate('/admin/login');
      }, 2000);
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeader();
      if (!headers) return;

      console.log('Fetching products with auth headers:', headers);
      const response = await axios.get(`${API_URL}/products`, {
        headers
      });
      console.log('Products fetched successfully:', response.data);
      setProducts(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching products:', err.response?.data || err.message);
      if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
        setTimeout(() => {
          navigate('/admin/login');
        }, 2000);
      } else {
        setError(err.response?.data?.message || 'Failed to fetch products');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      // Validate file types and sizes
      const validFiles = filesArray.filter(file => {
        const isValidType = file.type.startsWith('image/');
        const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB max
        
        if (!isValidType) {
          console.error('Invalid file type:', file.type);
        }
        
        if (!isValidSize) {
          console.error('File too large:', file.name);
        }
        
        return isValidType && isValidSize;
      });
      
      if (validFiles.length !== filesArray.length) {
        alert('Some files were skipped. Only images under 5MB are allowed.');
      }
      
      // Create preview URLs
      const newPreviewImages = validFiles.map(file => URL.createObjectURL(file));
      
      setSelectedImages(prev => [...prev, ...validFiles]);
      setPreviewImages(prev => [...prev, ...newPreviewImages]);
    }
  };

  const removePreviewImage = (index: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (publicId: string) => {
    setRemovedImages(prev => [...prev, publicId]);
  };

  const openAddModal = () => {
    setCurrentProduct(null);
    setFormData({
      name: '',
      price: '',
      category: 'Food',
      description: '',
      stock: '',
      featured: false
    });
    setSelectedImages([]);
    setPreviewImages([]);
    setRemovedImages([]);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      category: product.category,
      description: product.description,
      stock: product.stock.toString(),
      featured: product.featured
    });
    setSelectedImages([]);
    setPreviewImages([]);
    setRemovedImages([]);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const headers = getAuthHeader();
      if (!headers) return;
      
      // Convert images to base64
      const imagePromises = selectedImages.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const result = reader.result as string;
            // Validate the base64 string
            if (result && result.startsWith('data:image/')) {
              resolve(result);
            } else {
              console.error('Invalid image data:', file.name);
              reject(new Error('Invalid image data'));
            }
          };
          reader.onerror = error => {
            console.error('Error reading file:', error);
            reject(error);
          };
        });
      });
      
      let base64Images: string[] = [];
      try {
        base64Images = await Promise.all(imagePromises);
      } catch (imageError) {
        console.error('Error processing images:', imageError);
        setError('Error processing images. Please try again with different images.');
        setLoading(false);
        return;
      }
      
      const productData = {
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        description: formData.description,
        stock: parseInt(formData.stock),
        featured: formData.featured,
        images: base64Images,
        removedImages: removedImages
      };
      
      console.log('Submitting product data:', { 
        ...productData, 
        images: `${base64Images.length} images`,
        removedImages: removedImages 
      });
      
      let response;
      
      if (currentProduct) {
        // Update existing product
        response = await axios.put(`${API_URL}/products/${currentProduct._id}`, productData, {
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
        console.log('Product updated successfully:', response.data);
      } else {
        // Add new product
        response = await axios.post(`${API_URL}/products`, productData, {
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
        console.log('Product added successfully:', response.data);
      }
      
      // Refresh products list
      await fetchProducts();
      setIsModalOpen(false);
      
    } catch (err: any) {
      console.error('Error saving product:', err);
      console.error('Error details:', err.response?.data || err.message);
      
      if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
        setTimeout(() => {
          navigate('/admin/login');
        }, 2000);
      } else {
        setError(err.response?.data?.message || 'Failed to save product');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setLoading(true);
      try {
        const headers = getAuthHeader();
        if (!headers) return;
        
        console.log('Deleting product with ID:', id);
        await axios.delete(`${API_URL}/products/${id}`, {
          headers
        });
        console.log('Product deleted successfully');
        
        // Refresh products list
        await fetchProducts();
      } catch (err: any) {
        console.error('Error deleting product:', err);
        console.error('Error details:', err.response?.data || err.message);
        
        if (err.response?.status === 401) {
          setError('Authentication failed. Please log in again.');
          setTimeout(() => {
            navigate('/admin/login');
          }, 2000);
        } else {
          setError(err.response?.data?.message || 'Failed to delete product');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const getProductImage = useCallback((product: Product): string => {
    // Check if product has valid images
    if (product.images && 
        product.images.length > 0 && 
        product.images[0].url && 
        !imageErrors[product._id]) {
      return product.images[0].url;
    }
    return PLACEHOLDER_IMAGE;
  }, [imageErrors]);

  const handleImageError = useCallback((productId: string) => {
    setImageErrors(prev => ({
      ...prev,
      [productId]: true
    }));
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Manage Products</h1>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <PlusIconComponent className="h-5 w-5 mr-2" />
          Add Product
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading && !isModalOpen ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-500">Loading products...</p>
        </div>
      ) : (
        /* Products Table */
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Featured
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No products found. Add your first product!
                    </td>
                  </tr>
                ) : (
                  products.map(product => (
                    <tr key={product._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <img
                              className="h-10 w-10 rounded-md object-cover"
                              src={getProductImage(product)}
                              alt={product.name}
                              onError={() => handleImageError(product._id)}
                              loading="lazy"
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{product.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${product.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.stock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.featured ? 'Yes' : 'No'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <PencilIconComponent className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIconComponent className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">
              {currentProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Product Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    Price
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="stock" className="block text-sm font-medium text-gray-700">
                    Stock
                  </label>
                  <input
                    type="number"
                    id="stock"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="Food">Food</option>
                  <option value="Toys">Toys</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Health">Health</option>
                  <option value="Travel">Travel</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="featured"
                  name="featured"
                  checked={formData.featured}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="featured" className="ml-2 block text-sm text-gray-900">
                  Featured Product
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Images
                </label>
                
                {/* Image upload button */}
                <div className="mt-1 flex items-center">
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center"
                  >
                    <PhotoIconComponent className="h-5 w-5 mr-2" />
                    Add Images
                  </label>
                  <input
                    id="image-upload"
                    name="images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                </div>
                
                {/* Preview of existing images */}
                {currentProduct && currentProduct.images.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Current Images:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {currentProduct.images
                        .filter(img => !removedImages.includes(img.public_id))
                        .map((image, index) => (
                          <div key={image.public_id} className="relative">
                            <img
                              src={image.url}
                              alt={`Product ${index}`}
                              className="h-24 w-24 object-cover rounded-md"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(image.public_id)}
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 transform translate-x-1/3 -translate-y-1/3"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                
                {/* Preview of new images */}
                {previewImages.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">New Images:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {previewImages.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Preview ${index}`}
                            className="h-24 w-24 object-cover rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => removePreviewImage(index)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 transform translate-x-1/3 -translate-y-1/3"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-white hover:bg-blue-700 flex items-center"
                >
                  {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {currentProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
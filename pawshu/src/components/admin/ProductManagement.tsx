import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

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

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}

interface ProductFormProps {
  product: Product | null;
  onSubmit: (formData: any) => void;
  onCancel: () => void;
}

const API_URL = 'http://localhost:5000/api';
const PLACEHOLDER_IMAGE = '/placeholder.svg'; 

const ProductCard = ({ product, onEdit, onDelete }: ProductCardProps) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex items-center mb-2">
        <div className="w-16 h-16 mr-4 overflow-hidden rounded-md">
          <img 
            src={product.images && product.images.length > 0 ? product.images[0].url : PLACEHOLDER_IMAGE} 
            alt={product.name} 
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = PLACEHOLDER_IMAGE;
            }}
          />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <p className="text-gray-600">${product.price.toFixed(2)}</p>
        </div>
      </div>
      <p className="text-gray-700 mb-2 line-clamp-2">{product.description}</p>
      <div className="flex justify-between items-center">
        <span className={`px-2 py-1 rounded text-xs ${product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
        </span>
        <div>
          <button 
            onClick={() => onEdit(product)} 
            className="text-blue-500 hover:text-blue-700 mr-2"
          >
            Edit
          </button>
          <button 
            onClick={() => onDelete(product._id)} 
            className="text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductForm = ({ product, onSubmit, onCancel }: ProductFormProps) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price.toString() || '',
    category: product?.category || 'Food',
    description: product?.description || '',
    stock: product?.stock?.toString() || '0',
    featured: product?.featured || false,
    images: product?.images?.map(image => image.url) || []
  });
  
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert selected images to base64 before submitting
    const processImages = async () => {
      setIsUploading(true);
      try {
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
        
        const base64Images = await Promise.all(imagePromises);
        
        // Prepare the final form data with base64 images
        const finalFormData = {
          ...formData,
          images: base64Images,
          removedImages: removedImages
        };
        
        onSubmit(finalFormData);
      } catch (error) {
        console.error('Error processing images:', error);
        alert('Error processing images. Please try again with different images.');
      } finally {
        setIsUploading(false);
      }
    };
    
    processImages();
  };

  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };
  
  const removePreviewImage = (index: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const removeExistingImage = (url: string) => {
    // Extract public_id from the URL
    const urlParts = url.split('/');
    const filenameWithExt = urlParts[urlParts.length - 1];
    const publicId = filenameWithExt.split('.')[0];
    
    setRemovedImages(prev => [...prev, publicId]);
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(image => image !== url)
    }));
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">{product ? 'Edit Product' : 'Add New Product'}</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-gray-700 mb-2">Product Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="price" className="block text-gray-700 mb-2">Price</label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            min="0"
            step="0.01"
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="category" className="block text-gray-700 mb-2">Category</label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Food">Food</option>
            <option value="Toys">Toys</option>
            <option value="Accessories">Accessories</option>
            <option value="Health">Health</option>
            <option value="Travel">Travel</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label htmlFor="description" className="block text-gray-700 mb-2">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            required
          ></textarea>
        </div>
        
        <div className="mb-4">
          <label htmlFor="stock" className="block text-gray-700 mb-2">Stock</label>
          <input
            type="number"
            id="stock"
            name="stock"
            value={formData.stock}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            min="0"
          />
        </div>
        
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="featured"
              checked={formData.featured}
              onChange={handleInputChange}
              className="mr-2"
            />
            <span className="text-gray-700">Featured</span>
          </label>
        </div>
        
        {/* Existing Images */}
        {formData.images.length > 0 && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Current Images</label>
            <div className="flex flex-wrap gap-2">
              {formData.images.map((image: string, index: number) => (
                <div key={index} className="relative">
                  <img 
                    src={image} 
                    alt={`Product ${index}`} 
                    className="w-20 h-20 object-cover rounded-md"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                    onClick={() => removeExistingImage(image)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Preview of new images */}
        {previewImages.length > 0 && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">New Images</label>
            <div className="flex flex-wrap gap-2">
              {previewImages.map((preview, index) => (
                <div key={index} className="relative">
                  <img 
                    src={preview} 
                    alt={`Preview ${index}`} 
                    className="w-20 h-20 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                    onClick={() => removePreviewImage(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mb-4">
          <label htmlFor="images" className="block text-gray-700 mb-2">Upload Images</label>
          <input
            type="file"
            id="images"
            name="images"
            onChange={handleImageUpload}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            accept="image/*"
            multiple
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
          >
            {isUploading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {product ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </form>
    </div>
  );
};

const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const navigate = useNavigate();

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

  const handleAddProduct = () => {
    setCurrentProduct(null);
    setShowForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setCurrentProduct(product);
    setShowForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const headers = getAuthHeader();
      if (!headers) return;

      await axios.delete(`${API_URL}/products/${id}`, { headers });
      setProducts(products.filter(product => product._id !== id));
    } catch (err: any) {
      console.error('Error deleting product:', err);
      setError(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      const headers = getAuthHeader();
      if (!headers) return;
      
      setLoading(true);
      
      console.log('Submitting product data:', { 
        ...formData, 
        images: formData.images ? `${formData.images.length} images` : 'No images',
        removedImages: formData.removedImages ? formData.removedImages : 'No removed images'
      });

      if (currentProduct) {
        // Update existing product
        const response = await axios.put(
          `${API_URL}/products/${currentProduct._id}`,
          formData,
          { 
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Product updated successfully:', response.data);
        setProducts(products.map(p => (p._id === currentProduct._id ? response.data : p)));
      } else {
        // Create new product
        const response = await axios.post(
          `${API_URL}/products`, 
          formData, 
          { 
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Product created successfully:', response.data);
        setProducts([...products, response.data]);
      }
      setShowForm(false);
    } catch (err: any) {
      console.error('Error saving product:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
  };

  if (loading && !showForm) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Product Management</h1>
        <button
          onClick={handleAddProduct}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Add New Product
        </button>
      </div>

      {showForm ? (
        <ProductForm
          product={currentProduct}
          onSubmit={handleFormSubmit}
          onCancel={handleCancelForm}
        />
      ) : (
        <div>
          {products.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No products found. Add your first product!</p>
            </div>
          ) : (
            <div>
              {products.map(product => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onEdit={handleEditProduct}
                  onDelete={handleDeleteProduct}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductManagement; 
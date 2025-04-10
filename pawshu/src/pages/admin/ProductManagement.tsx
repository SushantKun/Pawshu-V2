import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      const response = await axios.get(`${API_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to fetch products');
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      await axios.delete(`${API_URL}/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setProducts(products.filter(product => product._id !== id));
      toast.success('Product deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleAddOrUpdateProduct = async (formData: FormData) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      // Convert FormData to regular object
      const productData: any = {};
      formData.forEach((value, key) => {
        // Skip files as we'll handle them separately
        if (key !== 'images' || !(value instanceof File)) {
          productData[key] = value;
        }
      });
      
      // Handle featured checkbox (comes as "on" string or doesn't exist)
      productData.featured = formData.has('featured');

      // Handle images conversion for Base64 encoding
      const imageFiles = formData.getAll('images') as File[];
      const validImageFiles = imageFiles.filter(file => file.size > 0);
      
      if (validImageFiles && validImageFiles.length > 0) {
        console.log('Processing images:', validImageFiles.map(f => ({name: f.name, type: f.type, size: f.size})));
        
        const imagePromises = validImageFiles.map(file => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              // reader.result contains the base64 data
              const base64String = reader.result as string;
              resolve(base64String);
            };
            reader.readAsDataURL(file);
          });
        });
        
        const base64Images = await Promise.all(imagePromises);
        console.log(`Converted ${base64Images.length} images to base64`);
        
        // Set the images array directly - this is what the server expects
        productData.images = base64Images;
        
        // If editing, add all existing image IDs to removedImages to ensure they're replaced
        if (editingProduct && editingProduct.images && editingProduct.images.length > 0) {
          productData.removedImages = editingProduct.images.map(img => img.public_id);
          console.log('Will remove existing images:', productData.removedImages);
        }
      } else {
        // If updating a product without changing images, don't send empty array
        if (!editingProduct) {
          productData.images = [];
        }
      }
      
      if (editingProduct) {
        // Update existing product
        const response = await axios.put(
          `${API_URL}/products/${editingProduct._id}`,
          productData,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Update the products list with the updated product
        setProducts(products.map(p => p._id === editingProduct._id ? response.data : p));
        toast.success('Product updated successfully');
      } else {
        // Create new product
        const response = await axios.post(
          `${API_URL}/products`,
          productData,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Add the new product to the products list
        setProducts([...products, response.data]);
        toast.success('Product added successfully');
      }
      
      // Reset form and state
      setShowForm(false);
      setEditingProduct(null);
    } catch (error: any) {
      console.error('Error saving product:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to save product');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Products</h1>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add New Product
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Image</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {products.map((product) => (
              <tr key={product._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-10 w-10 flex-shrink-0">
                    <img
                      className="h-10 w-10 rounded-full object-cover"
                      src={product.images && product.images.length > 0 ? product.images[0].url : PLACEHOLDER_IMAGE}
                      alt={product.name}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = PLACEHOLDER_IMAGE;
                      }}
                    />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{product.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{product.category}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">NPR {product.price.toFixed(2)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{product.stock}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    product.stock > 0
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(product)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product._id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity">
              <div className="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900 dark:opacity-90"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen"></span>&#8203;
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      {editingProduct ? 'Edit Product' : 'Add New Product'}
                    </h3>
                    <div className="mt-4">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const formData = new FormData(form);
                        handleAddOrUpdateProduct(formData);
                      }}>
                        <div className="mb-4">
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Product Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            defaultValue={editingProduct?.name || ''}
                            required
                            className="mt-1 p-2 w-full border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Category
                          </label>
                          <select
                            name="category"
                            id="category"
                            defaultValue={editingProduct?.category || ''}
                            required
                            className="mt-1 p-2 w-full border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">Select a category</option>
                            <option value="Food">Food</option>
                            <option value="Toys">Toys</option>
                            <option value="Accessories">Accessories</option>
                            <option value="Health">Health</option>
                            <option value="Grooming">Grooming</option>
                          </select>
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Price (NPR)
                          </label>
                          <input
                            type="number"
                            name="price"
                            id="price"
                            defaultValue={editingProduct?.price || ''}
                            min="0.01"
                            step="0.01"
                            required
                            className="mt-1 p-2 w-full border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="stock" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Stock
                          </label>
                          <input
                            type="number"
                            name="stock"
                            id="stock"
                            defaultValue={editingProduct?.stock || ''}
                            min="0"
                            required
                            className="mt-1 p-2 w-full border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Description
                          </label>
                          <textarea
                            name="description"
                            id="description"
                            rows={3}
                            defaultValue={editingProduct?.description || ''}
                            required
                            className="mt-1 p-2 w-full border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          ></textarea>
                        </div>
                        
                        <div className="mb-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              name="featured"
                              defaultChecked={editingProduct?.featured || false}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Featured Product</span>
                          </label>
                        </div>
                        
                        <div className="mb-4">
                          <label htmlFor="images" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Product Images
                          </label>
                          <input
                            type="file"
                            name="images"
                            id="images"
                            multiple
                            accept="image/*"
                            className="mt-1 p-2 w-full text-sm text-gray-700 dark:text-gray-300"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            You can select multiple images. Maximum 5 images.
                          </p>
                          
                          {editingProduct?.images && editingProduct.images.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-700 dark:text-gray-300">Current Images:</p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {editingProduct.images.map((image, index) => (
                                  <img
                                    key={index}
                                    src={image.url}
                                    alt={`Product ${index + 1}`}
                                    className="h-16 w-16 object-cover rounded"
                                  />
                                ))}
                              </div>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Upload new images to replace current ones.
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                          <button
                            type="submit"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                          >
                            {editingProduct ? 'Update Product' : 'Add Product'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCloseForm}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
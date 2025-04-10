import { useState, useEffect, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import axios from 'axios';
import type { ComponentType, SVGProps } from 'react';
import { HeartIcon as HeartIconOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import ChatButton from '../components/Chat';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const HeartIcon = HeartIconOutline as IconComponent;
const HeartSolidIcon = HeartIconSolid as IconComponent;

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
const PLACEHOLDER_IMAGE = '/placeholder.svg';

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useCart();
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/products`);
      console.log('Products fetched:', response.data);
      setProducts(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch products');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categories = ['all', ...new Set(products.map(product => product.category))];

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(product => product.category === selectedCategory);

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

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product._id,
      name: product.name,
      price: product.price,
      image: getProductImage(product)
    });
  };

  const toggleWishlist = (productId: string) => {
    if (isInWishlist(productId)) {
      removeFromWishlist(productId);
    } else {
      addToWishlist(productId);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-900">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-900 pt-24">
      <ChatButton />
      {/* Category Filter */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 dark:text-gray-400">No products found in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105">
              <div className="relative h-[300px]">
                <img
                  src={getProductImage(product)}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(product._id)}
                  loading="lazy"
                />
                <button
                  onClick={() => toggleWishlist(product._id)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-gray-700 shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  {isInWishlist(product._id) ? (
                    <HeartSolidIcon className="h-6 w-6 text-red-500" />
                  ) : (
                    <HeartIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                  )}
                </button>
                {product.featured && (
                  <div className="absolute top-4 left-4 bg-yellow-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    Featured
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{product.name}</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">NPR {product.price.toLocaleString('ne-NP')}</p>
                <div className="flex justify-between items-center">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    product.stock > 0 
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300' 
                      : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                  }`}>
                    {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                  </span>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={product.stock <= 0}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Products; 
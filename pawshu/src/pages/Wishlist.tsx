import { useState, useEffect, useCallback } from 'react';
import { useCart } from '../context/CartContext';
import { HeartIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import axios from 'axios';

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

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const HeartIconComponent = HeartIcon as IconComponent;

const Wishlist = () => {
  const { wishlist, removeFromWishlist, addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/products`);
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

  // Filter products that are in the wishlist
  const wishlistItems = products.filter(product => wishlist.includes(product._id));

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <HeartIconComponent className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your wishlist is empty</h2>
        <p className="text-gray-600 mb-8">Save items you love to your wishlist and they'll show up here</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">My Wishlist ({wishlistItems.length} items)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {wishlistItems.map(product => (
          <div key={product._id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative">
              <img
                src={getProductImage(product)}
                alt={product.name}
                className="w-full h-[300px] object-cover"
                onError={() => handleImageError(product._id)}
                loading="lazy"
              />
              <button
                onClick={() => removeFromWishlist(product._id)}
                className="absolute top-2 right-2 p-2 rounded-full bg-white shadow-md hover:bg-gray-100"
              >
                <HeartIconComponent className="h-6 w-6 text-red-500" />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
              <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold">${product.price.toFixed(2)}</span>
                <button
                  onClick={() => handleAddToCart(product)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={product.stock <= 0}
                >
                  {product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
              </div>
              {product.stock <= 5 && product.stock > 0 && (
                <p className="text-sm text-orange-500 mt-2">Only {product.stock} left in stock!</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Wishlist; 
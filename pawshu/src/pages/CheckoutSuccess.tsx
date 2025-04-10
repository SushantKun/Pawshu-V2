import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import api from '../api/axios';
import OrderSummary from '../components/orders/OrderSummary';
import { toast } from 'react-toastify';

interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

const CheckoutSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);

  // Function to fetch order details
  const fetchOrderDetails = async (id: string) => {
    setLoading(true);
    try {
      console.log('Fetching order details for:', id);
      const response = await api.get(`/orders/${id}`);
      
      // Get the order data from the response
      const orderData = response.data;
      
      // Remove any eSewa verification property if it exists
      if (orderData.esewaVerification) {
        delete orderData.esewaVerification;
      }
      
      setOrder(orderData);
      
      // Show toast if payment status is completed
      if (orderData.paymentStatus === 'completed') {
        toast.success('Payment has been verified and completed!');
      }
      
      setError('');
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // Handle order update from OrderSummary component
  const handleOrderUpdate = () => {
    if (orderId) {
      fetchOrderDetails(orderId);
    }
  };

  useEffect(() => {
    // Extract order ID from URL parameters
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('orderId');
    
    if (!id) {
      setError('Order ID not found');
      setLoading(false);
      return;
    }

    // Set order ID in state
    setOrderId(id);

    // Clear the cart
    clearCart();

    // Fetch order details
    fetchOrderDetails(id);
  }, [location.search, clearCart]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
        <p className="text-gray-600 mb-8">{error || 'Order not found'}</p>
        <button
          onClick={() => navigate('/products')}
          className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 dark:bg-gray-900 min-h-screen flex items-center justify-center pt-24">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 dark:bg-green-900">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-16 w-16 text-green-600 dark:text-green-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
            {order.paymentStatus === 'completed' ? 'Payment Successful!' : 'Order Received!'}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {order.paymentStatus === 'completed' 
              ? 'Thank you for your order. Your payment has been processed successfully.'
              : 'Thank you for your order. We\'re currently processing your payment.'}
          </p>
        </div>

        <OrderSummary order={order} onUpdate={handleOrderUpdate} />
        
        <div className="mt-8 flex justify-center space-x-4">
          <button
            onClick={() => navigate('/profile')}
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            View Your Orders
          </button>
          <button
            onClick={() => navigate('/products')}
            className="px-6 py-3 border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess; 
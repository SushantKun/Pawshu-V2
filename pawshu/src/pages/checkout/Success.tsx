import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../../context/CartContext';
import api from '../../api/axios';

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to track if we've already performed these operations
  const orderFetchedRef = useRef(false);

  useEffect(() => {
    // Parse the query parameters
    const searchParams = new URLSearchParams(location.search);
    const orderIdParam = searchParams.get('orderId');
    
    if (!orderIdParam || orderFetchedRef.current) return;
    
    setOrderId(orderIdParam);
    
    // First fetch order details
    const fetchOrderDetails = async () => {
      // Mark that we've started fetching to prevent duplicate fetches
      orderFetchedRef.current = true;
      
      try {
        console.log('Fetching order details for:', orderIdParam);
        
        // Get token from localStorage
        const token = localStorage.getItem('token');
        
        // Configure request with or without token
        const config = token ? {
          headers: { Authorization: `Bearer ${token}` }
        } : {};
        
        // Use the base URL directly since we're running on port 5173
        const response = await axios.get(`http://localhost:5000/api/orders/${orderIdParam}`, config);
        console.log('Received order details:', response.data);
        setOrderDetails(response.data);
        
        // Clear the cart after successful purchase
        clearCart();
        console.log('Cart cleared after successful purchase');
        
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch order details:', err);
        setError(err?.response?.data?.message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [location.search, clearCart]);

  // Fall back to just displaying order ID if we have no details
  const renderOrderConfirmation = () => {
    return (
      <div className="mb-8 text-center">
        <div className="border-t border-b border-gray-200 dark:border-gray-700 py-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Order Confirmation</h2>
          <p className="text-gray-600 dark:text-gray-300">Order ID: {orderId}</p>
          <p className="text-gray-600 dark:text-gray-300">
            Date: {new Date().toLocaleDateString()}
          </p>
          <p className="text-gray-600 dark:text-gray-300">Status: Payment Completed</p>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your order has been confirmed. You'll receive an email shortly with your order details.
        </p>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 pt-28 min-h-screen">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-100 text-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            Thank you for your order. Your payment has been processed successfully.
          </p>

          {loading ? (
            <div className="animate-pulse flex flex-col items-center space-y-4 mb-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          ) : error ? (
            orderDetails ? (
              <div className="mb-8 text-left">
                {renderOrderConfirmation()}
              </div>
            ) : (
              <div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
                  <p className="text-yellow-700 dark:text-yellow-300">
                    Your payment was successful, but we couldn't load the complete order details.
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                    Order ID: {orderId || 'Not available'}
                  </p>
                </div>
                {orderId && renderOrderConfirmation()}
              </div>
            )
          ) : (
            <>
              {orderDetails ? (
                <div className="mb-8 text-left">
                  <div className="border-t border-b border-gray-200 dark:border-gray-700 py-4 mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Order Summary</h2>
                    <p className="text-gray-600 dark:text-gray-300">Order ID: {orderId}</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      Date: {orderDetails.createdAt ? new Date(orderDetails.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">Status: {orderDetails.status || 'Completed'}</p>
                    <p className="text-gray-600 dark:text-gray-300">Payment Status: {orderDetails.paymentStatus || 'N/A'}</p>
                  </div>

                  <div className="space-y-4 mb-4">
                    <h3 className="text-md font-semibold text-gray-900 dark:text-white">Items</h3>
                    {orderDetails.items && Array.isArray(orderDetails.items) ? (
                      orderDetails.items.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-300">
                            {item.productName || 'Product'} x {item.quantity || 1}
                          </span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            NPR {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No items available</p>
                    )}
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600 dark:text-gray-300">Total</span>
                      <span className="text-gray-900 dark:text-white font-semibold">
                        NPR {orderDetails.totalAmount ? orderDetails.totalAmount.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                orderId && renderOrderConfirmation()
              )}
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/products')}
              className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 shadow-sm"
            >
              Continue Shopping
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
            >
              View Your Orders
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess; 
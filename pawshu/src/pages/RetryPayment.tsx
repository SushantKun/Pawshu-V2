import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import axios from 'axios';
import { toast } from 'react-toastify';
import EsewaPayment from '../components/EsewaPayment';

interface OrderDetails {
  _id: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  items: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity: number;
  }>;
}

interface EsewaFormData {
  amount: number;
  failure_url: string;
  product_delivery_charge: string;
  product_service_charge: string;
  product_code: string;
  signature: string;
  signed_field_names: string;
  success_url: string;
  tax_amount: string;
  total_amount: number;
  transaction_uuid: string;
}

const RetryPayment: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'esewa' | 'khalti'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [esewaFormData, setEsewaFormData] = useState<EsewaFormData | null>(null);
  const [showEsewaPayment, setShowEsewaPayment] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrderDetails(id);
    }
  }, [id]);

  const fetchOrderDetails = async (orderId: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/orders/${orderId}`);
      
      if (response.data.paymentStatus !== 'failed' || response.data.status !== 'pending') {
        setError('This order is not eligible for payment retry');
        setLoading(false);
        return;
      }
      
      setOrder(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching order details:', err);
      setError(err.response?.data?.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodChange = (method: 'card' | 'esewa' | 'khalti') => {
    setPaymentMethod(method);
  };

  const initiateEsewaPayment = async (orderId: string) => {
    try {
      console.log('Starting eSewa payment retry');
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication error. Please try logging in again.');
        setIsProcessing(false);
        return;
      }
      
      // Use direct axios call bypassing the interceptor
      const response = await axios.post(
        `http://localhost:5000/api/orders/${orderId}/retry-payment`, 
        {
          paymentMethod: 'esewa'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // If successful, get the eSewa payment data
      if (response.data.paymentData) {
        setEsewaFormData(response.data.paymentData);
        setShowEsewaPayment(true);
      } else {
        toast.error('Failed to get eSewa payment information');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error initiating eSewa payment:', error);
      toast.error('Failed to initiate eSewa payment');
      setIsProcessing(false);
    }
  };

  const initiateKhaltiPayment = async (orderId: string) => {
    try {
      console.log('Starting Khalti payment retry');
      setIsProcessing(true);
      
      // First update the order payment method
      await api.post(`/orders/${orderId}/retry-payment`, {
        paymentMethod: 'khalti'
      });
      
      // Then initiate Khalti payment
      const response = await api.post('/orders/khalti-payment', { 
        orderId,
        amount: order?.totalAmount || 0,
        returnUrl: `${window.location.origin}/checkout/success`
      });
      
      // Navigate to Khalti's payment page
      if (response.data.paymentUrl) {
        window.location.href = response.data.paymentUrl;
      } else {
        toast.error('Failed to get Khalti payment URL');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error initiating Khalti payment:', error);
      toast.error('Failed to initiate Khalti payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!order || !id) return;
    
    setIsProcessing(true);
    
    try {
      if (paymentMethod === 'esewa') {
        await initiateEsewaPayment(id);
      } else if (paymentMethod === 'khalti') {
        await initiateKhaltiPayment(id);
      } else {
        // For card payment, just update the payment method
        await api.post(`/orders/${id}/retry-payment`, {
          paymentMethod: 'card'
        });
        
        // Navigate to success page
        navigate(`/order/${id}`);
        toast.success('Payment method updated to card. Please complete your payment.');
      }
    } catch (error) {
      console.error('Error retrying payment:', error);
      toast.error('Failed to retry payment. Please try again.');
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-md w-full">
          <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
          <button
            onClick={() => navigate(-1)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-md w-full">
          <div className="text-red-600 dark:text-red-400 mb-4">Order not found</div>
          <button
            onClick={() => navigate('/profile')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Profile
          </button>
        </div>
      </div>
    );
  }

  // Show eSewa payment form if we have the data
  if (showEsewaPayment && esewaFormData) {
    return <EsewaPayment formData={esewaFormData} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Retry Payment</h1>
          
          <div className="mb-6">
            <div className="text-gray-700 dark:text-gray-300 mb-2">
              <strong>Order ID:</strong> #{order._id.slice(-8)}
            </div>
            <div className="text-gray-700 dark:text-gray-300 mb-4">
              <strong>Total Amount:</strong> NPR {order.totalAmount.toFixed(2)}
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
              <p className="text-yellow-700 dark:text-yellow-300">
                Your previous payment attempt was unsuccessful. Please select a payment method to try again.
              </p>
            </div>
          </div>
          
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Select Payment Method</h2>
            
            <div className="space-y-3">
              <div 
                className={`p-4 border rounded-lg cursor-pointer ${
                  paymentMethod === 'card' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                onClick={() => handlePaymentMethodChange('card')}
              >
                <div className="flex items-center">
                  <div className="h-5 w-5 mr-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      paymentMethod === 'card' 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-400'
                    }`}></div>
                  </div>
                  <span className="text-gray-900 dark:text-white font-medium">Credit/Debit Card</span>
                </div>
              </div>
              
              <div 
                className={`p-4 border rounded-lg cursor-pointer ${
                  paymentMethod === 'esewa' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                onClick={() => handlePaymentMethodChange('esewa')}
              >
                <div className="flex items-center">
                  <div className="h-5 w-5 mr-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      paymentMethod === 'esewa' 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-400'
                    }`}></div>
                  </div>
                  <span className="text-gray-900 dark:text-white font-medium">eSewa</span>
                </div>
              </div>
              
              <div 
                className={`p-4 border rounded-lg cursor-pointer ${
                  paymentMethod === 'khalti' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                onClick={() => handlePaymentMethodChange('khalti')}
              >
                <div className="flex items-center">
                  <div className="h-5 w-5 mr-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      paymentMethod === 'khalti' 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-400'
                    }`}></div>
                  </div>
                  <span className="text-gray-900 dark:text-white font-medium">Khalti</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleRetryPayment}
              disabled={isProcessing}
              className={`flex-1 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${
                isProcessing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing
                </span>
              ) : (
                'Proceed to Payment'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetryPayment; 
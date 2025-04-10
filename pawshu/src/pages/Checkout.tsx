import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../api/axios';
import axios from 'axios';
import { showSuccessNotification, NOTIFICATIONS } from '../utils/notification';
import EsewaPayment from '../components/EsewaPayment';
import { AxiosError } from 'axios';

// Khalti public key for the frontend
const KHALTI_PUBLIC_KEY = "995aacc263dc4f20b4beed4b2950dfba";

interface ShippingDetails {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
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

const initialShippingDetails: ShippingDetails = {
  firstName: '',
  lastName: '',
  email: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  phone: '',
};

// Add this helper function to handle API errors
const handleApiError = (error: unknown, defaultMessage: string) => {
  console.error(defaultMessage, error);
  if (error instanceof AxiosError && error.response) {
    console.error('Error details:', error.response.data);
    toast.error(`Payment error: ${error.response.data.message || 'Unknown error'}`);
  } else {
    toast.error(`${defaultMessage}. Please try again.`);
  }
};

const Checkout = () => {
  const { cartItems, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shippingDetails, setShippingDetails] = useState<ShippingDetails>(initialShippingDetails);
  const [step, setStep] = useState<'shipping' | 'payment'>('shipping');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'esewa' | 'khalti'>('card');
  const [esewaFormData, setEsewaFormData] = useState<EsewaFormData | null>(null);
  const [showEsewaPayment, setShowEsewaPayment] = useState(false);

  // Calculate total directly from items without any additional fees
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingDetails(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePaymentMethodChange = (method: 'card' | 'esewa' | 'khalti') => {
    setPaymentMethod(method);
  };

  const initiateEsewaPayment = async (orderId: string) => {
    try {
      console.log('Starting eSewa payment with order ID:', orderId);
      setIsProcessing(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication error. Please try logging in again.');
        setIsProcessing(false);
        return;
      }
      
      // Call the eSewa payment endpoint
      const response = await axios.post(
        'http://localhost:5000/api/orders/esewa-payment', 
        { orderId },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('eSewa payment response:', response.data);
      
      // If successful, set the eSewa form data and show payment form
      if (response.data) {
        setEsewaFormData(response.data);
        setShowEsewaPayment(true);
        // Processing will be disabled when the user returns from eSewa
      } else {
        toast.error('Failed to initialize eSewa payment');
        setIsProcessing(false);
      }
    } catch (error) {
      handleApiError(error, 'Failed to initialize eSewa payment');
      setIsProcessing(false);
    }
  };

  const initiateKhaltiPayment = async (orderId: string) => {
    try {
      console.log('Starting Khalti payment process');
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Authentication error. Please try logging in again.');
        setIsProcessing(false);
        return;
      }
      
      // Show a loading toast
      const loadingToast = toast.loading('Connecting to Khalti payment gateway...', {
        style: { minWidth: '250px' }
      });
      
      // First, check if the Khalti service is responsive by making a quick health check
      try {
        const healthCheckTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        );
        
        const healthCheckResponse = await Promise.race([
          axios.head('https://khalti.com', { timeout: 5000 }),
          healthCheckTimeout
        ]);
        
        console.log('Khalti service is available');
      } catch (healthError) {
        console.error('Khalti health check failed:', healthError);
        toast.dismiss(loadingToast);
        toast.error('Khalti payment service appears to be unavailable. Would you like to try eSewa instead?', {
          autoClose: 6000,
          style: { minWidth: '300px' }
        });
        
        // Add an option for the user to try eSewa
        const tryEsewa = window.confirm('Khalti payment service seems to be unavailable. Would you like to try eSewa instead?');
        if (tryEsewa) {
          setPaymentMethod('esewa');
          toast.success('Switched to eSewa payment method.');
          setIsProcessing(false);
          return;
        }
        
        setIsProcessing(false);
        return;
      }
      
      // If health check passes, proceed with the actual payment request
      try {
        // Update loading message
        toast.dismiss(loadingToast);
        const processingToast = toast.loading('Processing payment request...', {
          style: { minWidth: '250px' }
        });
        
        // Use direct axios call with increased timeout
        const response = await axios.post(
          'http://localhost:5000/api/orders/khalti-payment', 
          {
            orderId,
            amount: total.toFixed(2)
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            timeout: 30000 // 30 seconds timeout
          }
        );

        // Clear loading toast on success
        toast.dismiss(processingToast);
        console.log('Khalti payment response:', response.data);

        if (response.data && response.data.paymentUrl) {
          // Redirect to Khalti payment page
          toast.success('Redirecting to Khalti payment page...', {
            autoClose: 3000,
            style: { minWidth: '300px' }
          });
          
          // Delay redirect slightly to allow toast to be seen
          setTimeout(() => {
            window.location.href = response.data.paymentUrl;
          }, 1000);
        } else {
          toast.error('Failed to initialize Khalti payment. The payment gateway did not return the required data.', {
            style: { minWidth: '300px' }
          });
          setIsProcessing(false);
        }
      } catch (error: unknown) {
        toast.dismiss(loadingToast);
        console.error('Error initiating Khalti payment:', error);
        
        if (error instanceof AxiosError) {
          // Network or timeout errors
          if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            console.error('Khalti payment request timed out');
            toast.error('Connection to Khalti payment gateway timed out. Please try again or use a different payment method.', {
              style: { minWidth: '300px' }
            });
            
            // Suggest eSewa as an alternative
            const switchToEsewa = window.confirm('Would you like to try eSewa payment instead?');
            if (switchToEsewa) {
              setPaymentMethod('esewa');
              toast.success('Switched to eSewa payment method.');
            }
          } 
          // Server returned an error response
          else if (error.response) {
            console.error('Error details:', error.response.data);
            
            // Handle different error status codes appropriately
            if (error.response.status === 503 || error.response.status === 504) {
              toast.error('Khalti payment service is currently unavailable or not responding. Please try eSewa or card payment instead.', {
                style: { minWidth: '300px' }
              });
              
              // Auto-suggest eSewa
              const tryEsewa = window.confirm('Would you like to try eSewa payment instead?');
              if (tryEsewa) {
                setPaymentMethod('esewa');
                toast.success('Switched to eSewa payment method.');
              }
            } else {
              // Extract the most useful error message
              const errorMessage = 
                error.response.data?.message || 
                error.response.data?.error || 
                'Unknown payment gateway error';
              
              toast.error(`Payment error: ${errorMessage}`, {
                style: { minWidth: '300px' }
              });
            }
          } 
          // Request was made but no response received
          else if (error.request) {
            toast.error('No response received from the payment gateway. Please check your internet connection and try again.', {
              style: { minWidth: '300px' }
            });
          } 
          // Other errors during request setup
          else {
            toast.error('An error occurred while setting up the payment. Please try again.', {
              style: { minWidth: '300px' }
            });
          }
        } 
        // Non-Axios errors
        else {
          toast.error('Failed to initialize payment. Please try again or use a different payment method.', {
            style: { minWidth: '300px' }
          });
        }
        setIsProcessing(false);
      }
    } catch (topLevelError) {
      // Handle any unexpected errors at the top level
      console.error('Unexpected error during Khalti payment process:', topLevelError);
      toast.error('An unexpected error occurred. Please try again later or choose a different payment method.');
      setIsProcessing(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to complete your purchase');
      navigate('/login');
      return;
    }

    // Validate shipping details
    const requiredFields = [
      'firstName', 'lastName', 'email', 'address', 'city', 'state', 'postalCode', 'phone'
    ];
    
    const missingFields = requiredFields.filter(field => !shippingDetails[field as keyof ShippingDetails]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      setStep('shipping');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Prepare order items
      const items = cartItems.map(item => ({
        productId: item.id,
        productName: item.name,
        price: item.price,
        quantity: item.quantity
      }));
      
      const orderData = {
        items,
        totalAmount: parseFloat(total.toFixed(2)),
        shippingAddress: shippingDetails,
        paymentMethod: paymentMethod
      };
      
      console.log('Submitting order with data:', JSON.stringify(orderData, null, 2));
      
      // Create order
      const response = await api.post('/orders', orderData);
      
      console.log('Order created successfully:', response.data);
      
      // Get the order ID from the response
      const orderId = response.data.order._id;
      console.log('Created order ID:', orderId);
      
      if (paymentMethod === 'card') {
        // For card payments, directly mark payment as completed via API
        try {
          // Mark the payment as completed
          await axios.get(`http://localhost:5000/api/orders/verify-payment/${orderId}`);
          console.log('Card payment marked as completed');
        } catch (error) {
          console.error('Error marking card payment as completed:', error);
          // Continue anyway, as we'll show the success page
        }
        
        // Process card payment (existing flow)
        clearCart();
        
        // Show success notification
        showSuccessNotification(
          NOTIFICATIONS.PURCHASE.title,
          NOTIFICATIONS.PURCHASE.message
        );
        
        // Redirect to success page
        navigate('/checkout/success?orderId=' + orderId);
      } else if (paymentMethod === 'esewa') {
        // Start eSewa payment flow
        console.log('Starting eSewa payment flow for order:', orderId);
        await initiateEsewaPayment(orderId);
      } else if (paymentMethod === 'khalti') {
        // Start Khalti payment flow
        console.log('Starting Khalti payment flow for order:', orderId);
        try {
          await initiateKhaltiPayment(orderId);
        } catch (khaltiError) {
          console.error('Khalti payment failed, falling back to eSewa:', khaltiError);
          // If Khalti payment fails and we haven't auto-switched to eSewa yet,
          // try eSewa as a fallback
          try {
            toast.info('Trying eSewa as an alternative payment method...');
            await initiateEsewaPayment(orderId);
          } catch (esewaError) {
            console.error('Both Khalti and eSewa payment methods failed:', esewaError);
            toast.error('All payment gateways are currently unavailable. Please try again later or use card payment.');
            setPaymentMethod('card');
            setIsProcessing(false);
          }
        }
      }
    } catch (error: unknown) {
      console.error('Error placing order:', error);
      
      if (error instanceof AxiosError && error.response?.data) {
        console.error('Server error details:', error.response.data);
        const errorMsg = typeof error.response.data === 'object' 
          ? JSON.stringify(error.response.data)
          : error.response.data.toString();
        toast.error(`Order failed: ${errorMsg}`);
      } else {
        toast.error('Failed to place order. Please try again.');
      }
      
      setIsProcessing(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
        <p className="text-gray-600 mb-8">Add some items to your cart to checkout</p>
        <button
          onClick={() => navigate('/products')}
          className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Browse Products
        </button>
      </div>
    );
  }

  if (showEsewaPayment && esewaFormData) {
    return <EsewaPayment formData={esewaFormData} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-900 pt-24">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            {/* Progress Steps */}
            <div className="flex mb-8">
              <div className={`flex-1 text-center ${step === 'shipping' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                1. Shipping
              </div>
              <div className={`flex-1 text-center ${step === 'payment' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                2. Payment
              </div>
            </div>

            {step === 'shipping' ? (
              <form onSubmit={handleShippingSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      required
                      value={shippingDetails.firstName}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        shippingDetails.firstName ? 'border-gray-300' : 'border-red-500 dark:border-red-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      required
                      value={shippingDetails.lastName}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        shippingDetails.lastName ? 'border-gray-300' : 'border-red-500 dark:border-red-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={shippingDetails.email}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        shippingDetails.email ? 'border-gray-300' : 'border-red-500 dark:border-red-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      value={shippingDetails.phone}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        shippingDetails.phone ? 'border-gray-300' : 'border-red-500 dark:border-red-500'
                      }`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      required
                      value={shippingDetails.address}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        shippingDetails.address ? 'border-gray-300' : 'border-red-500 dark:border-red-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      required
                      value={shippingDetails.city}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        shippingDetails.city ? 'border-gray-300' : 'border-red-500 dark:border-red-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      required
                      value={shippingDetails.state}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        shippingDetails.state ? 'border-gray-300' : 'border-red-500 dark:border-red-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Postal Code</label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      required
                      value={shippingDetails.postalCode}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        shippingDetails.postalCode ? 'border-gray-300' : 'border-red-500 dark:border-red-500'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Continue to Payment
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Payment Method</label>
                  <div className="flex flex-col space-y-3">
                    <div 
                      className={`flex items-center p-4 border rounded-md cursor-pointer
                        ${paymentMethod === 'card' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700' 
                          : 'border-gray-200 dark:border-gray-700'}`}
                      onClick={() => handlePaymentMethodChange('card')}
                    >
                      <input
                        type="radio"
                        id="card"
                        name="paymentMethod"
                        checked={paymentMethod === 'card'}
                        onChange={() => handlePaymentMethodChange('card')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="card" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        Credit / Debit Card
                      </label>
                    </div>
                    
                    <div 
                      className={`flex items-center p-4 border rounded-md cursor-pointer
                        ${paymentMethod === 'esewa' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700' 
                          : 'border-gray-200 dark:border-gray-700'}`}
                      onClick={() => handlePaymentMethodChange('esewa')}
                    >
                      <input
                        type="radio"
                        id="esewa"
                        name="paymentMethod"
                        checked={paymentMethod === 'esewa'}
                        onChange={() => handlePaymentMethodChange('esewa')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="esewa" className="ml-3 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        Pay with eSewa
                      </label>
                    </div>
                    
                    <div 
                      className={`flex items-center p-4 border rounded-md cursor-pointer
                        ${paymentMethod === 'khalti' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700' 
                          : 'border-gray-200 dark:border-gray-700'}`}
                      onClick={() => handlePaymentMethodChange('khalti')}
                    >
                      <input
                        type="radio"
                        id="khalti"
                        name="paymentMethod"
                        checked={paymentMethod === 'khalti'}
                        onChange={() => handlePaymentMethodChange('khalti')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="khalti" className="ml-3 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        Pay with Khalti
                      </label>
                    </div>
                  </div>
                </div>
                
                {paymentMethod === 'card' && (
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Card Number</label>
                      <input
                        type="text"
                        id="cardNumber"
                        required
                        placeholder="1234 5678 9012 3456"
                        className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date</label>
                        <input
                          type="text"
                          id="expiry"
                          required
                          placeholder="MM/YY"
                          className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </div>
                      <div>
                        <label htmlFor="cvc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">CVC</label>
                        <input
                          type="text"
                          id="cvc"
                          required
                          placeholder="123"
                          className="mt-1 block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {paymentMethod === 'esewa' && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        You will be redirected to eSewa to complete your payment. Once the payment is successful, you will be redirected back to this site.
                      </p>
                    </div>
                  </div>
                )}
                
                {paymentMethod === 'khalti' && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        You will be redirected to Khalti to complete your payment. Once the payment is successful, you will be redirected back to this site.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('shipping')}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800"
                  >
                    Back to Shipping
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className={`px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 ${
                      isProcessing ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {isProcessing ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      `Pay NPR ${total.toFixed(2)}`
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:w-1/3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Order Summary</h2>
            <div className="space-y-4">
              {cartItems.map(item => (
                <div key={item.id} className="flex justify-between">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-300">{item.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Quantity: {item.quantity}</p>
                  </div>
                  <p className="font-medium text-gray-800 dark:text-gray-300">NPR {(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between border-t pt-2">
                  <p className="font-semibold text-gray-900 dark:text-white">Total</p>
                  <p className="font-semibold text-gray-900 dark:text-white">NPR {total.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout; 
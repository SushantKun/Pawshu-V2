import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { showSuccessNotification, NOTIFICATIONS } from '../utils/notification';
import EsewaPayment from '../components/EsewaPayment';
import KhaltiPayment from '../components/KhaltiPayment';
import { AxiosError } from 'axios';

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

interface KhaltiFormData {
  amount: number;
  orderId: string;
  returnUrl: string;
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

const Checkout = () => {
  const { cartItems, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shippingDetails, setShippingDetails] = useState<ShippingDetails>(initialShippingDetails);
  const [step, setStep] = useState<'shipping' | 'payment'>('shipping');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'esewa' | 'khalti'>('card');
  const [esewaFormData, setEsewaFormData] = useState<EsewaFormData | null>(null);
  const [khaltiFormData, setKhaltiFormData] = useState<KhaltiFormData | null>(null);
  const [showEsewaPayment, setShowEsewaPayment] = useState(false);
  const [showKhaltiPayment, setShowKhaltiPayment] = useState(false);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = cartItems.length > 0 ? 5.99 : 0;
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + shipping + tax;

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
      // Start the eSewa payment flow
      const response = await api.post('/orders/esewa-payment', {
        orderId,
        amount: total.toFixed(2)
      });

      if (response.data.formData) {
        setEsewaFormData(response.data.formData);
        setShowEsewaPayment(true);
      } else {
        toast.error('Failed to initialize eSewa payment');
      }
    } catch (error) {
      console.error('Error initiating eSewa payment:', error);
      toast.error('Failed to initialize payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const initiateKhaltiPayment = async (orderId: string) => {
    try {
      // Start the Khalti payment flow
      const response = await api.post('/orders/khalti-payment', {
        orderId,
        amount: parseInt(total.toFixed(0)) // Use integer amount to avoid decimal issues
      });

      if (response.data) {
        setKhaltiFormData({
          amount: parseInt(total.toFixed(0)), // Use integer amount
          orderId: response.data.orderId,
          returnUrl: window.location.origin + '/checkout/success'
        });
        setShowKhaltiPayment(true);
      } else {
        toast.error('Failed to initialize Khalti payment');
      }
    } catch (error: any) {
      console.error('Error initiating Khalti payment:', error);
      if (error.response?.data?.details) {
        console.error('Khalti error details:', error.response.data.details);
        toast.error(`Payment error: ${error.response.data.details.error_key || 'Unknown error'}`);
      } else {
        toast.error('Failed to initialize payment. Please try again.');
      }
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
      
      console.log('Submitting order with data:', {
        items,
        totalAmount: parseFloat(total.toFixed(2)),
        shippingAddress: shippingDetails
      });
      
      // Create order
      const response = await api.post('/orders', {
        items,
        totalAmount: parseFloat(total.toFixed(2)), // Make sure it's a number, not a string
        shippingAddress: shippingDetails
      });
      
      console.log('Order created successfully:', response.data);
      
      if (paymentMethod === 'card') {
        // Process card payment (existing flow)
        // Clear cart
        clearCart();
        
        // Show success notification
        showSuccessNotification(
          NOTIFICATIONS.PURCHASE.title,
          NOTIFICATIONS.PURCHASE.message
        );
        
        // Redirect to success page
        navigate('/checkout/success?orderId=' + response.data.order._id);
      } else if (paymentMethod === 'esewa') {
        // Start eSewa payment flow
        await initiateEsewaPayment(response.data.order._id);
      } else if (paymentMethod === 'khalti') {
        // Start Khalti payment flow
        await initiateKhaltiPayment(response.data.order._id);
      }
    } catch (error: unknown) {
      console.error('Error placing order:', error);
      
      if (error instanceof AxiosError && error.response?.data) {
        console.error('Server error details:', error.response.data);
        toast.error(error.response.data.message || 'Failed to place order. Please try again.');
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

  if (showKhaltiPayment && khaltiFormData) {
    return <KhaltiPayment formData={khaltiFormData} />;
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
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Payment Method</h3>
                  
                  <div className="space-y-4">
                    <div 
                      className={`p-4 border rounded-md cursor-pointer ${
                        paymentMethod === 'card' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      onClick={() => handlePaymentMethodChange('card')}
                    >
                      <div className="flex items-center">
                        <input 
                          type="radio" 
                          name="paymentMethod" 
                          id="card" 
                          value="card" 
                          checked={paymentMethod === 'card'} 
                          onChange={() => handlePaymentMethodChange('card')} 
                          className="mr-2"
                        />
                        <label htmlFor="card" className="text-base text-gray-900 dark:text-white">Credit / Debit Card</label>
                      </div>
                    </div>
                    
                    <div 
                      className={`p-4 border rounded-md cursor-pointer ${
                        paymentMethod === 'esewa' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      onClick={() => handlePaymentMethodChange('esewa')}
                    >
                      <div className="flex items-center">
                        <input 
                          type="radio" 
                          name="paymentMethod" 
                          id="esewa" 
                          value="esewa" 
                          checked={paymentMethod === 'esewa'} 
                          onChange={() => handlePaymentMethodChange('esewa')} 
                          className="mr-2"
                        />
                        <label htmlFor="esewa" className="text-base text-gray-900 dark:text-white flex items-center">
                          Pay with eSewa
                          <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">Recommended</span>
                        </label>
                      </div>
                    </div>
                    
                    <div 
                      className={`p-4 border rounded-md cursor-pointer ${
                        paymentMethod === 'khalti' 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      onClick={() => handlePaymentMethodChange('khalti')}
                    >
                      <div className="flex items-center">
                        <input 
                          type="radio" 
                          name="paymentMethod" 
                          id="khalti" 
                          value="khalti" 
                          checked={paymentMethod === 'khalti'} 
                          onChange={() => handlePaymentMethodChange('khalti')} 
                          className="mr-2"
                        />
                        <label htmlFor="khalti" className="text-base text-gray-900 dark:text-white">
                          Pay with Khalti
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment description */}
                {paymentMethod === 'card' && (
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-gray-700 dark:text-gray-300">
                      You will be redirected to a secure payment page to complete your payment.
                    </p>
                  </div>
                )}
                
                {paymentMethod === 'esewa' && (
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-gray-700 dark:text-gray-300">
                      You will be redirected to eSewa to complete your payment. Once the payment is successful, you will be redirected back to this site.
                    </p>
                  </div>
                )}
                
                {paymentMethod === 'khalti' && (
                  <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-gray-700 dark:text-gray-300">
                      You will be redirected to Khalti to complete your payment. Once the payment is successful, you will be redirected back to this site.
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('shipping')}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Back to Shipping
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Processing...' : `Pay NPR ${total.toFixed(2)}`}
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
                <div className="flex justify-between mb-2">
                  <p className="text-gray-600 dark:text-gray-400">Subtotal</p>
                  <p className="font-medium text-gray-800 dark:text-gray-300">NPR {subtotal.toFixed(2)}</p>
                </div>
                <div className="flex justify-between mb-2">
                  <p className="text-gray-600 dark:text-gray-400">Shipping</p>
                  <p className="font-medium text-gray-800 dark:text-gray-300">NPR {shipping.toFixed(2)}</p>
                </div>
                <div className="flex justify-between mb-2">
                  <p className="text-gray-600 dark:text-gray-400">Tax</p>
                  <p className="font-medium text-gray-800 dark:text-gray-300">NPR {tax.toFixed(2)}</p>
                </div>
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
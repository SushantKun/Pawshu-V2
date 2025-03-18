import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { showSuccessNotification, NOTIFICATIONS } from '../utils/notification';

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

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to complete your purchase');
      navigate('/login');
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
      
      // Create order
      const response = await api.post('/orders', {
        items,
        totalAmount: total,
        shippingAddress: shippingDetails
      });
      
      // Clear cart
      clearCart();
      
      // Show success notification
      showSuccessNotification(
        NOTIFICATIONS.PURCHASE.title,
        NOTIFICATIONS.PURCHASE.message
      );
      
      // Redirect to success page
      navigate('/');
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
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
                    className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Place Order
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
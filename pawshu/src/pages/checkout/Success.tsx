import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../../context/CartContext';
import api from '../../api/axios';
import { RiCheckboxCircleFill, RiErrorWarningFill, RiTimeLine, RiInformationLine } from 'react-icons/ri';

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(searchParams.get('order'));
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<boolean>(
    searchParams.get('status') === 'Completed' || searchParams.get('verified') === 'true'
  );
  const [verificationAttempted, setVerificationAttempted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const token = localStorage.getItem('token');
  
  // Use refs to track if we've already performed these operations
  const orderFetchedRef = useRef(false);
  const cartClearedRef = useRef(false);

  // Check if this is a verified Khalti payment but no order ID
  const khaltiPidx = searchParams.get('pidx');
  
  // Check for the manual update parameter
  const manualUpdate = searchParams.get('manual_update') === 'true';

  // Function to manually refresh order status
  const refreshOrderStatus = async () => {
    try {
      setRefreshing(true);
      const orderToUse = orderId || searchParams.get('order') || '';
      if (!orderToUse) {
        throw new Error('Order ID not found');
      }

      console.log('Manually refreshing order details for order:', orderToUse);

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await axios.get(`http://localhost:5000/api/orders/${orderToUse}`, config);
      console.log('Refreshed order details:', response.data);

      setOrderDetails(response.data);

      // If it's still pending but should be complete due to verification,
      // show it as complete in the UI
      if (response.data.paymentStatus === 'pending' && verificationStatus) {
        const updatedOrderDetails = {
          ...response.data,
          paymentStatus: 'completed'
        };
        setOrderDetails(updatedOrderDetails);
        setVerificationStatus(true);
      }

      return response.data;
    } catch (error: any) {
      console.error('Failed to refresh order details:', error);
      setError(error?.message || 'Failed to refresh order status');
      return null;
    } finally {
      setRefreshing(false);
    }
  };

  const fetchOrderDetails = async () => {
    // Return early if we've already fetched this order
    if (orderFetchedRef.current) {
      return;
    }

    try {
      // Use order ID from URL or from state
      const orderToUse = orderId;
      if (!orderToUse) {
        throw new Error('Order ID not found');
      }
      
      console.log('Fetching order details for order:', orderToUse);
      console.log('Parameters:', { 
        isVerified: verificationStatus, 
        status: searchParams.get('status'), 
        manualUpdate 
      });

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      // Mark as fetched to prevent infinite loops
      orderFetchedRef.current = true;

      const response = await axios.get(`http://localhost:5000/api/orders/${orderToUse}`, config);
      console.log('Order details response:', response.data);

      // Check if payment status is still pending but we know it should be completed
      if (response.data.paymentStatus === 'pending' && verificationStatus) {
        console.log('Payment status is still pending but verification was successful. Refreshing in 2 seconds...');
        
        // Go ahead and update the UI to show completed for better user experience
        const updatedOrderDetails = {
          ...response.data,
          paymentStatus: 'completed',
          manualUpdate: manualUpdate
        };
        setOrderDetails(updatedOrderDetails);
        
        // Wait 2 seconds and try fetching again
        setTimeout(async () => {
          try {
            const refreshResponse = await axios.get(`http://localhost:5000/api/orders/${orderToUse}`, config);
            console.log('Refreshed order details:', refreshResponse.data);
            
            // Only update if the status is now completed
            if (refreshResponse.data.paymentStatus === 'completed') {
              setOrderDetails(refreshResponse.data);
            }
          } catch (refreshErr) {
            console.error('Failed to refresh order details:', refreshErr);
            // Keep showing the completed status in UI
          }
        }, 2000);
      } else {
        setOrderDetails(response.data);
      }
      
      // Clear cart after successful purchase (only once)
      if (!cartClearedRef.current) {
        clearCart();
        cartClearedRef.current = true;
      }

      setLoading(false);
    } catch (error: any) {
      setError(error?.message || 'Error fetching order details');
      console.error('Error fetching order details:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Order ID from URL:', orderId);
    console.log('Search params:', Object.fromEntries(searchParams.entries()));
    console.log('Verification status:', verificationStatus);
    console.log('Manual update:', manualUpdate);
    
    // Don't try to fetch if orderId is "user" - this causes an infinite loop
    if (orderId === "user") {
      console.warn('Found "user" as orderId, skipping fetch');
      setLoading(false);
      setError('Invalid order ID');
      return;
    }
    
    // If we have a valid orderId, fetch the order details
    if (orderId && !orderFetchedRef.current) {
      fetchOrderDetails();
    } else if (khaltiPidx && !orderFetchedRef.current) {
      // We have Khalti payment data but no order ID
      setLoading(false);
      setError(`Your payment was processed but we couldn't find your order details. Please contact customer support with your Khalti transaction ID: ${khaltiPidx}`);
    } else if (!orderFetchedRef.current) {
      setLoading(false);
    }
    // Only depend on orderId, not searchParams to prevent re-fetching
  }, [orderId]);

  // Improved order confirmation renderer with more detailed information
  const renderOrderConfirmation = () => {
    if (!orderId) {
      return (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-800/20 text-red-800 dark:text-red-300 rounded-md">
          <p>No order information available.</p>
        </div>
      );
    }

    return (
      <div className="mb-8 text-center">
        <div className="p-6 mb-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-700 dark:text-gray-300 mb-2">
            Order ID: <span className="font-semibold text-gray-900 dark:text-white">{orderId}</span>
          </p>
          {orderDetails ? (
            <>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Status: <span className="font-semibold text-gray-900 dark:text-white">{orderDetails.status}</span>
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Payment Status: <span className="font-semibold text-gray-900 dark:text-white">{orderDetails.paymentStatus}</span>
              </p>
              {orderDetails.items && orderDetails.items.length > 0 && (
                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Order Items:</p>
                  {orderDetails.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between text-sm mb-1">
                      <span>{item.productName} x {item.quantity}</span>
                      <span>NPR {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span>Total:</span>
                    <span>NPR {orderDetails.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              Order information is being loaded...
            </p>
          )}
        </div>
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

                    {/* Display payment verification status if available */}
                    {verificationStatus && (
                      <div className={`mt-2 p-2 rounded ${verificationStatus ? 'bg-green-100 dark:bg-green-800/20 text-green-800 dark:text-green-200'
                          : 'bg-yellow-100 dark:bg-yellow-800/20 text-yellow-800 dark:text-yellow-200'
                        }`}>
                        <p className="text-sm font-medium">
                          {orderDetails.paymentMethod === 'esewa' ? 'eSewa' : orderDetails.paymentMethod === 'khalti' ? 'Khalti' : 'Payment'} Verification: {verificationStatus}
                          {orderDetails.esewaRefId && (
                            <span className="block text-xs mt-1">Reference ID: {orderDetails.esewaRefId}</span>
                          )}
                          {orderDetails.transactionId && (
                            <span className="block text-xs mt-1">Transaction ID: {orderDetails.transactionId}</span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Special notification for Khalti payments that appear pending but are actually completed */}
                    {!verificationStatus && orderDetails.paymentMethod === 'khalti' && orderDetails.paymentStatus === 'pending' && searchParams.get('verified') === 'true' && (
                      <div className="mt-2 p-2 rounded bg-green-100 dark:bg-green-800/20 text-green-800 dark:text-green-200">
                        <p className="text-sm font-medium">
                          Khalti Payment: Completed
                          <span className="block text-xs mt-1">Your payment was successful! The order status will be updated shortly.</span>
                        </p>
                      </div>
                    )}

                    {/* Notification when manual update was used */}
                    {orderDetails.manualUpdate && (
                      <div className="mt-2 p-2 rounded bg-blue-100 dark:bg-blue-800/20 text-blue-800 dark:text-blue-200">
                        <p className="text-sm font-medium">
                          Note: Your payment was processed through a backup verification method.
                          <span className="block text-xs mt-1">If you encounter any issues, please contact customer support.</span>
                        </p>
                      </div>
                    )}
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

              {/* For pending Khalti payments, show refresh button */}
              {orderDetails && orderDetails.paymentMethod === 'khalti' && orderDetails.paymentStatus === 'pending' && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    Your payment was processed by Khalti, but our system is still updating your order status.
                  </p>
                  <button
                    onClick={refreshOrderStatus}
                    disabled={refreshing}
                    className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm rounded-md flex items-center justify-center"
                  >
                    {refreshing ? (
                      <>
                        <span className="mr-2">Refreshing</span>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </>
                    ) : (
                      "Refresh Order Status"
                    )}
                  </button>
                </div>
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
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

/**
 * This component handles Khalti payment callbacks and redirects to our success page
 */
const KhaltiRedirect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [verifying, setVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    const verifyPayment = async () => {
      setVerifying(true);
      try {
        // Extract query parameters
        const currentParams = new URLSearchParams(location.search);

        // Get necessary parameters
        const pidx = currentParams.get('pidx');
        const status = currentParams.get('status');
        const transaction_id = currentParams.get('transaction_id');
        const purchase_order_id = currentParams.get('purchase_order_id');

        // Extract the orderId from the purchase_order_id
        const orderId = purchase_order_id?.split('_').pop() || '';

        if (!pidx || !status) {
          setVerifyError('Missing payment information');
          setVerifying(false);
          return;
        }

        console.log('Verifying Khalti payment with params:', {
          pidx,
          status,
          transaction_id,
          purchase_order_id,
          orderId
        });

        // Call the verification endpoint if status is completed
        if (status === 'Completed') {
          const token = localStorage.getItem('token');
          const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

          // Use API server URL from environment
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
          let verifyUrl = `${apiUrl}/orders/verify-khalti?pidx=${pidx}&status=${status}`;

          // Add transaction ID if available
          if (transaction_id) {
            verifyUrl += `&transaction_id=${transaction_id}`;
          }

          // Add purchase_order_id if available for order ID extraction
          if (purchase_order_id) {
            verifyUrl += `&purchase_order_id=${purchase_order_id}`;
            console.log('Including purchase_order_id in verification request:', purchase_order_id);
          }

          console.log('Calling verification endpoint:', verifyUrl);
          
          const startTime = new Date().getTime();
          const response = await axios.get(verifyUrl, config);
          const endTime = new Date().getTime();
          console.log(`Verification request took ${endTime - startTime}ms`);
          console.log('Khalti verification response:', response.data);
          
          setIsVerified(true);
          setVerifyError(null);
          
          // Record verification time for debugging
          console.log('Verification completed successfully at:', new Date().toISOString());
          
          // Proceed with redirection after verification
          const redirectParams = new URLSearchParams();
          
          // If we have an order ID from the response, use it
          if (response.data && response.data.order && response.data.order.id) {
            console.log('Redirecting with order ID from response:', response.data.order.id);
            redirectParams.set('order', response.data.order.id);
          } else if (orderId) {
            // Otherwise use the ID we extracted from purchase_order_id
            console.log('Response did not contain order ID, using extracted ID:', orderId);
            redirectParams.set('order', orderId);
          } else {
            // Last resort: create a param that indicates we're returning from Khalti but don't have the order ID
            console.log('No order ID available, using pidx as identifier');
            redirectParams.set('khalti_pidx', pidx);
          }
          
          redirectParams.set('status', status);
          redirectParams.set('verified', 'true');
          
          const redirectUrl = `/checkout/success?${redirectParams.toString()}`;
          console.log('Redirecting to success page:', redirectUrl);
          
          navigate(redirectUrl, { replace: true });
        } else {
          // If not completed status, still redirect but mark as not verified
          console.log('Payment not completed, status:', status);
          setIsVerified(false);
          setVerifyError(`Payment not completed. Status: ${status}`);
          
          const redirectParams = new URLSearchParams();
          
          if (orderId) {
            redirectParams.set('order', orderId);
          }
          
          redirectParams.set('status', status);
          redirectParams.set('verified', 'false');
          redirectParams.set('error', `Payment not completed: ${status}`);
          
          const redirectUrl = `/checkout/success?${redirectParams.toString()}`;
          console.log('Redirecting to success page with error:', redirectUrl);
          
          navigate(redirectUrl, { replace: true });
        }
      } catch (error: any) {
        console.error('Khalti verification error:', error);
        if (error.response) {
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
        }
        
        const errorMessage = error.response?.data?.message || error.message || 'Verification failed';
        console.error('Error message:', errorMessage);
        setVerifyError(errorMessage);
        
        // Check if we should retry
        if (retries < MAX_RETRIES) {
          const retryNumber = retries + 1;
          console.log(`Error during verification. Retrying (${retryNumber}/${MAX_RETRIES})...`);
          setRetries(retryNumber);
          
          // Exponential backoff: wait longer between retries
          const retryDelay = 1000 * Math.pow(2, retries); // 1s, 2s, 4s
          console.log(`Waiting ${retryDelay}ms before retry ${retryNumber}`);
          
          setTimeout(verifyPayment, retryDelay);
          return;
        }
        
        // If we've reached max retries, try the manual update endpoint as last resort
        console.log('Max retries reached. Attempting manual update...');
        const currentParams = new URLSearchParams(location.search);
        const purchase_order_id = currentParams.get('purchase_order_id');
        const orderId = purchase_order_id?.split('_').pop() || '';
        const status = currentParams.get('status') || 'unknown';
        const pidx = currentParams.get('pidx');
        const transaction_id = currentParams.get('transaction_id');
        
        if (orderId && pidx && status === 'Completed') {
          try {
            // We have enough information to try a manual update
            console.log('Trying manual order update as fallback with order ID:', orderId);
            const token = localStorage.getItem('token');
            const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
            
            // Use API server URL from environment
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const updateUrl = `${apiUrl}/orders/update-khalti-payment`;
            
            console.log('Calling manual update endpoint:', updateUrl);
            console.log('Update payload:', { orderId, pidx, transaction_id });
            
            const updateResponse = await axios.post(updateUrl, {
              orderId,
              pidx,
              transaction_id
            }, config);
            
            console.log('Manual update response:', updateResponse.data);
            
            if (updateResponse.data.success) {
              console.log('Manual update successful');
              setIsVerified(true);
              setVerifyError(null);
              
              // Proceed with redirection after manual update
              const redirectParams = new URLSearchParams();
              redirectParams.set('order', orderId);
              redirectParams.set('status', status);
              redirectParams.set('verified', 'true');
              redirectParams.set('manual_update', 'true');
              
              const redirectUrl = `/checkout/success?${redirectParams.toString()}`;
              console.log('Redirecting to success page after manual update:', redirectUrl);
              
              navigate(redirectUrl, { replace: true });
              return;
            } else {
              console.error('Manual update failed:', updateResponse.data.message);
            }
          } catch (updateError: any) {
            console.error('Manual update also failed:', updateError);
            console.error('Manual update error details:', 
              updateError.response?.data || updateError.message);
          }
        } else {
          console.log('Cannot attempt manual update, missing required data.',
            { orderId, pidx, status });
        }
        
        // If we get here, all attempts have failed
        if (orderId) {
          console.log('All verification attempts failed. Redirecting with error flag.');
          const redirectParams = new URLSearchParams();
          redirectParams.set('order', orderId);
          redirectParams.set('status', status || 'unknown');
          redirectParams.set('verified', 'false');
          redirectParams.set('error', 'verification_failed');
          
          const redirectUrl = `/checkout/success?${redirectParams.toString()}`;
          console.log('Redirecting to success page with verification_failed:', redirectUrl);
          
          navigate(redirectUrl, { replace: true });
        } else {
          console.log('All verification attempts failed. Cannot redirect (no order ID).');
          setVerifying(false);
        }
      }
    };

    verifyPayment();
  }, [location.search, navigate, retries, MAX_RETRIES]);

  if (verifying && !isVerified && !verifyError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="p-8 max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-center text-blue-600 dark:text-blue-400">Verifying Payment</h2>
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-center">
            Please wait while we verify your payment with Khalti.
            <br />This may take a few moments...
          </p>
          {retries > 0 && (
            <p className="mt-4 text-amber-600 dark:text-amber-400 text-center text-sm">
              Verification attempt {retries}/{MAX_RETRIES}...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="p-8 max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-center text-red-600 dark:text-red-400">Payment Error</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 text-center">
            {verifyError}
          </p>
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/checkout')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Return to checkout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default loading state (should be very brief)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
        <p className="mt-4 text-center text-gray-600 dark:text-gray-300">Redirecting...</p>
      </div>
    </div>
  );
};

export default KhaltiRedirect; 
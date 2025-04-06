import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

interface EsewaPaymentProps {
  formData: {
    amount: string | number;
    tax_amount: string;
    total_amount: string | number;
    transaction_uuid: string;
    product_code: string;
    product_service_charge: string;
    product_delivery_charge: string;
    success_url: string;
    failure_url: string;
    signed_field_names: string;
    signature: string;
  };
  onSuccess?: (transactionId: string) => void;
}

const EsewaPayment: React.FC<EsewaPaymentProps> = ({ formData, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  useEffect(() => {
    // Validate required form data
    if (!formData.transaction_uuid || !formData.total_amount || !formData.success_url) {
      console.error('Invalid eSewa form data - missing required fields:', formData);
      setHasError(true);
      setErrorMessage('Payment cannot be processed due to missing information. Please try again.');
      return;
    }
    
    // Log data for debugging
    console.log('eSewa payment form data:', formData);
    
    // Submit form automatically when component mounts
    submitPaymentForm();
  }, []);

  const submitPaymentForm = () => {
    try {
      setIsSubmitting(true);
      
      // Ensure all values are strings
      const processedFormData = {
        amount: String(formData.amount),
        tax_amount: formData.tax_amount,
        total_amount: String(formData.total_amount),
        transaction_uuid: formData.transaction_uuid,
        product_code: formData.product_code,
        product_service_charge: formData.product_service_charge,
        product_delivery_charge: formData.product_delivery_charge,
        success_url: formData.success_url,
        failure_url: formData.failure_url,
        signed_field_names: formData.signed_field_names,
        signature: formData.signature
      };
      
      // Additional validation
      if (!processedFormData.transaction_uuid) {
        throw new Error('Transaction UUID is required');
      }
      
      // eSewa test environment URL as specified in documentation
      const esewaUrl = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
  
      // Create and configure the form element
      const form = document.createElement("form");
      form.setAttribute("method", "POST");
      form.setAttribute("action", esewaUrl);
      form.setAttribute("id", "esewa-payment-form");
      form.setAttribute("name", "esewaForm");
      form.style.display = "none"; // Hide the form
  
      // Add all formData fields as hidden inputs
      for (const key in processedFormData) {
        if (Object.prototype.hasOwnProperty.call(processedFormData, key)) {
          const hiddenField = document.createElement("input");
          hiddenField.setAttribute("type", "hidden");
          hiddenField.setAttribute("name", key);
          // Set value as string
          hiddenField.setAttribute("value", String(processedFormData[key as keyof typeof processedFormData]));
          form.appendChild(hiddenField);
          
          // Log each field for debugging
          console.log(`eSewa form field: ${key} = ${processedFormData[key as keyof typeof processedFormData]}`);
        }
      }
  
      // Append form to document body and submit it
      document.body.appendChild(form);
      console.log('eSewa payment form created and ready to submit');
      
      // Add a brief delay before submitting to allow console logs to be captured
      setTimeout(() => {
        try {
          form.submit();
          console.log('eSewa payment form submitted');
        } catch (submitError) {
          console.error('Error during form submission:', submitError);
          setHasError(true);
          setErrorMessage('Failed to submit payment form. Please try again.');
          setIsSubmitting(false);
          throw submitError;
        }
      }, 500);
    } catch (error: any) {
      console.error('Error submitting eSewa form:', error);
      setHasError(true);
      setErrorMessage(error.message || 'Payment processing failed. Please try again.');
      setIsSubmitting(false);
      toast.error('Payment processing failed. Please try again.');
    }
  };

  // Automatically check payment status on component mount and attempt verification
  useEffect(() => {
    // Set a function to check payment status periodically
    const checkPaymentStatus = () => {
      console.log('Checking eSewa payment status for:', formData.transaction_uuid);
      
      // Try direct verification with the server
      api.post('/appointments/manual-verify', {
        appointmentId: formData.transaction_uuid,
        method: 'esewa'
      })
      .then(response => {
        if (response.data.status === 'Complete') {
          console.log('Auto-verification successful');
          toast.success('Payment completed successfully!');
          clearTimeout(timerId);
          if (onSuccess) {
            onSuccess(formData.transaction_uuid);
          }
          window.location.href = `/profile?status=success&paymentMethod=esewa&appointmentId=${formData.transaction_uuid}`;
        }
      })
      .catch(error => {
        console.error('Error in auto-verification attempt:', error);
      });
    };
    
    // Start checking after the form is submitted (giving time for the user to complete payment)
    const timerId = setTimeout(() => {
      // First check
      checkPaymentStatus();
      
      // Then set interval to check every 5 seconds (for up to 30 seconds)
      let attempts = 0;
      const maxAttempts = 6;
      const interval = setInterval(() => {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.log('Reached maximum verification attempts');
          return;
        }
        checkPaymentStatus();
      }, 5000);
      
      // Clean up interval on component unmount
      return () => {
        clearInterval(interval);
      };
    }, 10000); // Start checking 10 seconds after the form is submitted
    
    return () => {
      clearTimeout(timerId);
    };
  }, [formData.transaction_uuid, onSuccess]);

  // Check URL parameters for payment status on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oid = urlParams.get('oid') || formData.transaction_uuid;
    const amt = urlParams.get('amt') || String(formData.amount);
    const refId = urlParams.get('refId');
    const status = urlParams.get('status');

    console.log('eSewa callback parameters:', { oid, amt, refId, status });

    // If we have all required parameters, verify the payment
    if (oid && amt && refId) {
      console.log('Verifying eSewa payment with full parameters...');
      verifyPayment(oid, amt, refId);
    } else if (status === 'success' && formData.transaction_uuid) {
      // If we have a success status but missing some parameters, try verifying with transaction_uuid
      console.log('Attempting verification with transaction_uuid...');
      
      // First try manual verification
      api.post('/appointments/manual-verify', {
        appointmentId: formData.transaction_uuid,
        method: 'esewa'
      })
      .then(response => {
        if (response.data.status === 'Complete') {
          console.log('Manual verification successful');
          toast.success('Payment completed successfully!');
          if (onSuccess) {
            onSuccess(formData.transaction_uuid);
          }
          window.location.href = `/profile?status=success&paymentMethod=esewa&appointmentId=${formData.transaction_uuid}`;
          return;
        }
        
        // If manual verification fails, check appointment status
        return api.get(`/appointments/${formData.transaction_uuid}`);
      })
      .then(response => {
        if (response?.data.payment?.status === 'paid') {
          console.log('Payment already marked as paid');
          toast.success('Payment completed successfully!');
          if (onSuccess) {
            onSuccess(formData.transaction_uuid);
          }
          window.location.href = `/profile?status=success&paymentMethod=esewa&appointmentId=${formData.transaction_uuid}`;
        } else if (response?.data.payment?.status === 'pending') {
          console.log('Payment still pending, retrying verification...');
          // Try one more time with manual verification after a short delay
          setTimeout(() => {
            api.post('/appointments/manual-verify', {
              appointmentId: formData.transaction_uuid,
              method: 'esewa'
            })
            .then(retryResponse => {
              if (retryResponse.data.status === 'Complete') {
                console.log('Retry verification successful');
                toast.success('Payment completed successfully!');
                if (onSuccess) {
                  onSuccess(formData.transaction_uuid);
                }
                window.location.href = `/profile?status=success&paymentMethod=esewa&appointmentId=${formData.transaction_uuid}`;
              } else {
                setHasError(true);
                setErrorMessage('Payment verification failed. Please try again or contact support.');
                toast.error('Payment verification failed');
              }
            })
            .catch(error => {
              console.error('Error in retry verification:', error);
              setHasError(true);
              setErrorMessage('Failed to verify payment. Please contact support.');
              toast.error('Failed to verify payment');
            });
          }, 2000); // Wait 2 seconds before retrying
        }
      })
      .catch(error => {
        console.error('Error in payment verification:', error);
        setHasError(true);
        setErrorMessage('Failed to verify payment. Please contact support.');
        toast.error('Failed to verify payment');
      });
    }
  }, [formData]);

  // Handle payment verification
  const verifyPayment = async (oid: string, amt: string, refId: string) => {
    try {
      console.log('Sending verification request to server...', { oid, amt, refId });
      const response = await api.post('/appointments/esewa/verify', {
        oid,
        amt,
        refId
      });

      if (response.data.success) {
        console.log('Payment verified successfully!');
        toast.success('Payment verified successfully!');
        if (onSuccess) {
          onSuccess(refId);
        }
        // Redirect to profile with success parameters
        window.location.href = `/profile?status=success&paymentMethod=esewa&appointmentId=${oid}`;
      } else {
        console.log('Payment verification failed, trying manual verification...');
        // Try manual verification as fallback
        const manualResponse = await api.post('/appointments/manual-verify', {
          appointmentId: oid,
          method: 'esewa'
        });
        
        if (manualResponse.data.status === 'Complete') {
          console.log('Manual verification successful');
          toast.success('Payment completed successfully!');
          if (onSuccess) {
            onSuccess(refId);
          }
          window.location.href = `/profile?status=success&paymentMethod=esewa&appointmentId=${oid}`;
          return;
        }
        
        setHasError(true);
        setErrorMessage('Payment verification failed. Please try again.');
        toast.error('Payment verification failed');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      setHasError(true);
      setErrorMessage('Failed to verify payment. Please contact support.');
      toast.error('Failed to verify payment');
    }
  };

  if (hasError) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <div className="mb-6">
            <div className="h-12 w-12 mx-auto mb-4 bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Payment Error</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{errorMessage}</p>
          </div>
          <a
            href="/profile"
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full inline-block"
          >
            Return to Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <div className="animate-pulse mb-6">
          <div className="h-12 w-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Redirecting to eSewa</h2>
          <p className="text-gray-600 dark:text-gray-300">Please wait, you're being redirected to the eSewa payment gateway...</p>
        </div>
        {!isSubmitting && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              If you are not redirected automatically, please click the button below.
            </p>
            <button
              onClick={submitPaymentForm}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
            >
              Proceed to eSewa
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EsewaPayment; 
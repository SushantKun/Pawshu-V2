import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface KhaltiFormData {
  amount: number;
  orderId: string;
  returnUrl?: string;
  customerInfo?: {
    name: string;
    email: string;
    phone: string;
  };
}

interface KhaltiPaymentProps {
  formData: KhaltiFormData;
}

const KhaltiPayment: React.FC<KhaltiPaymentProps> = ({ formData }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initiatePayment = async () => {
      try {
        setLoading(true);
        
        // Call your server endpoint to initialize Khalti payment
        const response = await fetch(`${import.meta.env.VITE_API_URL}/orders/khalti-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            orderId: formData.orderId,
            amount: formData.amount,
            customerInfo: formData.customerInfo
          }),
        });

        const data = await response.json();

        if (data.success && data.payment_url) {
          // Redirect to Khalti's payment URL
          window.location.href = data.payment_url;
        } else {
          setError(data.message || 'Failed to initiate payment');
          setLoading(false);
        }
      } catch (error) {
        console.error("Error initiating Khalti payment:", error);
        setError('Failed to connect to payment server');
        setLoading(false);
      }
    };

    initiatePayment();
  }, [formData]);

  const handleCancel = () => {
    navigate('/checkout');
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="p-8 max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-center text-red-600 dark:text-red-400">Payment Error</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 text-center">
            {error}
          </p>
          <div className="mt-6 text-center">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Return to checkout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center dark:text-white">Khalti Payment</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-8 text-center">
          Processing your payment with Khalti.
          <br />
          Amount: NPR {formData.amount.toFixed(2)}
        </p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Please wait while we redirect you to the Khalti payment page.
        </p>
        <div className="mt-6 text-center">
          <button
            onClick={handleCancel}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Cancel and return to checkout
          </button>
        </div>
      </div>
    </div>
  );
};

// Define the Khalti types
declare global {
  interface Window {
    KhaltiCheckout: any;
  }
}

export default KhaltiPayment; 
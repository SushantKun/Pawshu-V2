import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import EsewaPayment from './EsewaPayment';

interface Appointment {
  _id: string;
  doctor: {
    _id: string;
    firstName: string;
    lastName: string;
    specialization: string;
  };
  date: string;
  timeSlot: string;
  petName: string;
  status: string;
  payment?: {
    status: string;
    amount: number;
    method?: string;
  };
}

interface EsewaFormData {
  amount: string;
  tax_amount: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  product_service_charge: string;
  product_delivery_charge: string;
  success_url: string;
  failure_url: string;
  signed_field_names: string;
  signature: string;
}

interface AppointmentPaymentProps {
  appointment: Appointment;
  onPaymentComplete: () => void;
}

const AppointmentPayment: React.FC<AppointmentPaymentProps> = ({ appointment, onPaymentComplete }) => {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'esewa' | 'khalti'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [esewaFormData, setEsewaFormData] = useState<EsewaFormData | null>(null);
  const [showEsewaPayment, setShowEsewaPayment] = useState(false);

  const handlePaymentMethodChange = (method: 'card' | 'esewa' | 'khalti') => {
    setPaymentMethod(method);
  };

  const initiateEsewaPayment = async () => {
    try {
      setIsProcessing(true);
      
      // Validate the appointment has payment information
      if (!appointment.payment || !appointment.payment.amount) {
        toast.error('Payment amount is not set properly. Please contact support.');
        setIsProcessing(false);
        return;
      }
      
      // First update the appointment payment method
      await api.put(`/appointments/${appointment._id}/payment`, {
        method: 'esewa',
        status: 'pending'
      });
      
      // Then initiate eSewa payment
      const response = await api.post('/appointments/esewa-payment', {
        appointmentId: appointment._id,
        amount: appointment.payment.amount
      });
      
      // Validate response data
      if (response.data && response.data.formData && 
          response.data.formData.transaction_uuid && 
          response.data.formData.success_url && 
          response.data.formData.failure_url) {
        
        console.log('eSewa form validation passed:', response.data.formData);
        setEsewaFormData(response.data.formData);
        setShowEsewaPayment(true);
      } else {
        console.error('Invalid eSewa form data:', response.data);
        toast.error('Failed to initiate eSewa payment: Invalid response data');
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('Error initiating eSewa payment:', error);
      const errorMessage = error.response?.data?.message || 'Failed to initiate eSewa payment';
      toast.error(errorMessage);
      setIsProcessing(false);
    }
  };

  const initiateKhaltiPayment = async () => {
    try {
      setIsProcessing(true);
      
      // First update the appointment payment method
      await api.put(`/appointments/${appointment._id}/payment`, {
        method: 'khalti',
        status: 'pending'
      });
      
      // Then initiate Khalti payment similar to product payment flow
      const response = await api.post('/appointments/khalti-payment', {
        appointmentId: appointment._id,
        amount: appointment.payment?.amount || 0,
        returnUrl: `${window.location.origin}/profile?status=success&appointmentId=${appointment._id}`
      });
      
      if (response.data && response.data.paymentUrl) {
        // Store pidx in localStorage before redirecting for verification on return
        if (response.data.pidx) {
          localStorage.setItem('appointment_payment_pidx', response.data.pidx);
          localStorage.setItem('appointment_id', appointment._id);
        }
        
        // Redirect to Khalti payment page
        window.location.href = response.data.paymentUrl;
      } else {
        toast.error('Failed to initiate Khalti payment');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error initiating Khalti payment:', error);
      toast.error('Failed to initiate Khalti payment');
      setIsProcessing(false);
    }
  };

  const processCardPayment = async () => {
    try {
      setIsProcessing(true);
      
      // For demonstration, we'll process card payment directly
      const response = await api.put(`/appointments/${appointment._id}/payment`, {
        status: 'paid',
        method: 'card',
        transactionId: `manual-${Date.now()}`
      });
      
      toast.success('Payment processed successfully');
      onPaymentComplete();
    } catch (error) {
      console.error('Error processing card payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = () => {
    if (paymentMethod === 'esewa') {
      initiateEsewaPayment();
    } else if (paymentMethod === 'khalti') {
      initiateKhaltiPayment();
    } else {
      processCardPayment();
    }
  };

  // Check URL parameters and localStorage for payment information on component mount
  useEffect(() => {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const paymentMethod = urlParams.get('paymentMethod');
    const appointmentId = urlParams.get('appointmentId');
    const refId = urlParams.get('refId');
    const oid = urlParams.get('oid');
    const amt = urlParams.get('amt');
    
    console.log('Payment verification parameters:', { 
      status, 
      paymentMethod, 
      appointmentId,
      refId,
      oid,
      amt 
    });
    
    // Handle eSewa payment verification
    if (status === 'success' && (paymentMethod === 'esewa' || oid)) {
      console.log('Auto-verifying eSewa payment...');
      const verifyId = appointmentId || oid || appointment._id;
      
      // Try to verify immediately
      api.post('/appointments/manual-verify', {
        appointmentId: verifyId,
        method: 'esewa'
      })
      .then(response => {
        if (response.data.status === 'Complete') {
          console.log('eSewa verification successful');
          toast.success('Payment completed successfully!');
          onPaymentComplete();
        } else {
          // If first attempt fails, check appointment status
          return api.get(`/appointments/${verifyId}`);
        }
      })
      .then(response => {
        if (response?.data.payment?.status === 'paid') {
          console.log('Payment already marked as paid');
          toast.success('Payment completed successfully!');
          onPaymentComplete();
        } else if (response?.data.payment?.status === 'pending') {
          // Try one more time after a short delay
          setTimeout(() => {
            api.post('/appointments/manual-verify', {
              appointmentId: verifyId,
              method: 'esewa'
            })
            .then(retryResponse => {
              if (retryResponse.data.status === 'Complete') {
                console.log('Retry verification successful');
                toast.success('Payment completed successfully!');
                onPaymentComplete();
              }
            })
            .catch(error => {
              console.error('Error in retry verification:', error);
            });
          }, 2000);
        }
      })
      .catch(error => {
        console.error('Error in eSewa payment verification:', error);
      });
      return;
    }
    
    // Handle Khalti payment verification (existing code)
    const storedPidx = localStorage.getItem('appointment_payment_pidx');
    const storedAppointmentId = localStorage.getItem('appointment_id');
    
    if ((status === 'success' && appointmentId) || (storedPidx && storedAppointmentId === appointment._id)) {
      // Use pidx from URL or localStorage, prioritize URL
      const verificationPidx = appointmentId || storedPidx;
      
      // Verify the payment
      api.post('/appointments/khalti-verify', {
        pidx: verificationPidx,
        appointment_id: appointment._id
      })
      .then(response => {
        if (response.data.status === 'Complete') {
          toast.success('Payment verified successfully');
          onPaymentComplete();
          
          // Clean up localStorage
          localStorage.removeItem('appointment_payment_pidx');
          localStorage.removeItem('appointment_id');
        } else {
          toast.error('Payment verification failed. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error verifying payment:', error);
        toast.error('Failed to verify payment. Please try again or contact support.');
      });
    }
  }, [appointment._id, onPaymentComplete]);

  if (showEsewaPayment && esewaFormData) {
    return <EsewaPayment formData={esewaFormData} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Complete Your Payment</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Your appointment with Dr. {appointment.doctor.firstName} {appointment.doctor.lastName} has been confirmed.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Date: {new Date(appointment.date).toLocaleDateString()} at {appointment.timeSlot}
        </p>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-2">
          Total Amount: Rs. {appointment.payment?.amount || 0}
        </p>
      </div>
      
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Payment Method</h3>
        
        <div className="grid grid-cols-3 gap-3">
          <div
            onClick={() => handlePaymentMethodChange('card')}
            className={`p-3 border rounded-lg text-center cursor-pointer ${
              paymentMethod === 'card'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-sm">Card</span>
          </div>
          
          <div
            onClick={() => handlePaymentMethodChange('esewa')}
            className={`p-3 border rounded-lg text-center cursor-pointer ${
              paymentMethod === 'esewa'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <img
              src="/esewa-logo.png"
              alt="eSewa"
              className="h-6 w-6 mx-auto mb-1"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.style.display = 'none';
              }}
            />
            <span className="text-sm">eSewa</span>
          </div>
          
          <div
            onClick={() => handlePaymentMethodChange('khalti')}
            className={`p-3 border rounded-lg text-center cursor-pointer ${
              paymentMethod === 'khalti'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <img
              src="/khalti-logo.png"
              alt="Khalti"
              className="h-6 w-6 mx-auto mb-1"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.style.display = 'none';
              }}
            />
            <span className="text-sm">Khalti</span>
          </div>
        </div>
      </div>
      
      <button
        onClick={handlePayment}
        disabled={isProcessing}
        className={`w-full py-2 px-4 rounded font-medium ${
          isProcessing
            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-500'
        }`}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="ml-2">Processing...</span>
          </div>
        ) : (
          `Pay with ${paymentMethod === 'card' ? 'Card' : paymentMethod === 'esewa' ? 'eSewa' : 'Khalti'}`
        )}
      </button>
    </div>
  );
};

export default AppointmentPayment; 
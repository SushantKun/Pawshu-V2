import React, { useEffect } from 'react';
import { toast } from 'react-toastify';

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
  useEffect(() => {
    // Log data for debugging
    console.log('eSewa payment form data:', formData);
    
    // Submit form automatically when component mounts
    submitPaymentForm();
  }, []);

  const submitPaymentForm = () => {
    try {
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
      
      // eSewa test environment URL as specified in documentation
      const esewaUrl = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
  
      // Create and configure the form element
      const form = document.createElement("form");
      form.setAttribute("method", "POST");
      form.setAttribute("action", esewaUrl);
      form.setAttribute("id", "esewa-payment-form");
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
      
      // Submit immediately
      form.submit();
      console.log('eSewa payment form submitted');
    } catch (error) {
      console.error('Error submitting eSewa form:', error);
      toast.error('Payment processing failed. Please try again.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <div className="animate-pulse mb-6">
          <div className="h-12 w-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Redirecting to eSewa</h2>
          <p className="text-gray-600 dark:text-gray-300">Please wait, you're being redirected to the eSewa payment gateway...</p>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          If you are not redirected automatically, please click the button below.
        </p>
        <button
          onClick={submitPaymentForm}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full"
        >
          Proceed to eSewa
        </button>
      </div>
    </div>
  );
};

export default EsewaPayment; 
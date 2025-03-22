import React, { useEffect } from 'react';
import { toast } from 'react-toastify';

interface EsewaPaymentProps {
  formData: {
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
  };
  donationInfo?: {
    charityId: string;
    charityName: string;
  };
  onSuccess?: (transactionId: string) => void;
}

const EsewaPayment: React.FC<EsewaPaymentProps> = ({ formData, donationInfo, onSuccess }) => {
  useEffect(() => {
    // Submit form automatically when component mounts
    submitPaymentForm();
  }, []);

  const submitPaymentForm = () => {
    try {
      // Ensure total_amount is a number
      const totalAmount = typeof formData.total_amount === 'number' 
        ? formData.total_amount 
        : parseFloat(String(formData.total_amount));
      
      // Store donation information in sessionStorage if it exists
      if (donationInfo) {
        sessionStorage.setItem('donationInfo', JSON.stringify({
          ...donationInfo,
          amount: totalAmount,
          transactionId: formData.transaction_uuid
        }));
        
        // Also store transaction info in localStorage as a backup for error handling
        localStorage.setItem('lastEsewaTransaction', JSON.stringify({
          transaction_uuid: formData.transaction_uuid,
          amount: totalAmount,
          charityId: donationInfo.charityId,
          charityName: donationInfo.charityName,
          timestamp: Date.now()
        }));
      }

      // Make sure formData uses the correct redirect URLs
      const formDataWithCorrectUrl = {
        ...formData,
        total_amount: totalAmount,
        // Pass transaction ID in URL for error cases
        success_url: `${formData.success_url}?transaction_uuid=${formData.transaction_uuid}`,
        failure_url: `${window.location.origin}/checkout`
      };
      
      console.log('Submitting eSewa payment with data:', formDataWithCorrectUrl);
      
      // eSewa test environment URL
      const path = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
  
      // Create and configure the form element
      const form = document.createElement("form");
      form.setAttribute("method", "POST");
      form.setAttribute("action", path);
      form.setAttribute("id", "esewa-payment-form");
      form.style.display = "none"; // Hide the form
  
      // Add all formData fields as hidden inputs
      for (const key in formDataWithCorrectUrl) {
        if (Object.prototype.hasOwnProperty.call(formDataWithCorrectUrl, key)) {
          const hiddenField = document.createElement("input");
          hiddenField.setAttribute("type", "hidden");
          hiddenField.setAttribute("name", key);
          // Convert values to string and set attribute
          hiddenField.setAttribute("value", String(formDataWithCorrectUrl[key as keyof typeof formDataWithCorrectUrl]));
          form.appendChild(hiddenField);
        }
      }
  
      // Append form to document body and submit it
      document.body.appendChild(form);
      
      // Submit immediately
      form.submit();
    } catch (error) {
      console.error('Error submitting eSewa form:', error);
      toast.error('Payment processing failed. Please try again.');
    }
  };

  return (
    <div className="flex justify-center items-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Processing Payment</h2>
        <p className="text-gray-600">Redirecting to payment gateway...</p>
      </div>
    </div>
  );
};

export default EsewaPayment; 
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { showSuccessNotification, NOTIFICATIONS } from '../utils/notification';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

// Convert the icon to a component type that can be used in JSX
const ArrowLeftIconComponent = ArrowLeftIcon as ComponentType<SVGProps<SVGSVGElement>>;

interface Charity {
  _id: string;
  name: string;
  description: string;
  image: {
    url: string;
  };
  goal: number;
  raised: number;
}

interface CardPaymentFormProps {
  charity: Charity;
  amount: number;
  onSuccess: (donationDetails: any) => void;
  onCancel: () => void;
  fetchCharities: () => void;
}

// Simplified Card Payment Form - focus on UX not API
const CardPaymentForm: React.FC<CardPaymentFormProps> = ({ 
  charity, 
  amount, 
  onSuccess, 
  onCancel,
  fetchCharities
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Handle form submit
  const handleSubmit = () => {
    // Validate fields
    if (!cardNumber) {
      toast.error('Please enter a card number');
      return;
    }
    if (!cardExpiry) {
      toast.error('Please enter card expiry date');
      return;
    }
    if (!cardCvv) {
      toast.error('Please enter card CVV');
      return;
    }

    // Show processing state
    setIsProcessing(true);
    
    // Show success notification
    showSuccessNotification(
      NOTIFICATIONS.DONATION.title,
      `Thank you for your donation of NPR ${amount.toLocaleString()} to ${charity.name}!`
    );
    
    // Simulate API call
    setTimeout(() => {
      const donationData = {
        _id: `mock-${Date.now()}`,
        charityId: charity._id,
        charityName: charity.name,
        amount: amount,
        status: 'completed',
        createdAt: new Date().toISOString()
      };
      
      // Show success screen
      setIsProcessing(false);
      setShowSuccess(true);
      
      // Refresh charity data
      fetchCharities();
      
      // Also notify parent component of success
      setTimeout(() => {
        onSuccess(donationData);
      }, 500);
    }, 1500);
  };

  // Success screen
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-24">
        <div className="max-w-md mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm p-6 text-center">
          <div className="text-green-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Thank You for Your Donation!</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Your generous contribution will make a difference in the lives of animals in need.
          </p>
          <div className="mb-6 p-4 bg-gray-200 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Donation Details</h3>
            <p><span className="font-medium">Amount:</span> NPR {amount.toLocaleString()}</p>
            <p><span className="font-medium">Charity:</span> {charity.name}</p>
            <p><span className="font-medium">Date:</span> {new Date().toLocaleDateString()}</p>
            <p><span className="font-medium">Status:</span> <span className="text-green-500">Completed</span></p>
          </div>
          <button
            onClick={() => onSuccess({
              _id: `success-${Date.now()}`,
              amount: amount,
              charityName: charity.name,
              status: 'completed'
            })}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
          >
            Return to Donations
          </button>
        </div>
      </div>
    );
  }

  // Payment form
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-24">
      <div className="max-w-md mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              onClick={onCancel}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mr-2"
            >
              <ArrowLeftIconComponent className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Card Payment</h2>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {charity.name}
          </h3>
          <p className="text-md font-medium text-gray-800 dark:text-gray-200">
            Donation Amount: NPR {amount.toLocaleString()}
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Card Number
            </label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder="1234 5678 9012 3456"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring focus:ring-blue-300 dark:focus:ring-blue-700 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              maxLength={16}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Expiry Date
              </label>
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCardExpiry(value);
                }}
                placeholder="MM/YY"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring focus:ring-blue-300 dark:focus:ring-blue-700 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                maxLength={5}
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                CVV
              </label>
              <input
                type="text"
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="123"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring focus:ring-blue-300 dark:focus:ring-blue-700 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                maxLength={3}
              />
            </div>
          </div>
          
          <button
            type="button" 
            onClick={handleSubmit}
            disabled={isProcessing}
            className={`w-full py-3 px-4 rounded-lg font-semibold ${
              isProcessing
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span className="ml-2">Processing...</span>
              </div>
            ) : (
              'Complete Payment'
            )}
          </button>
          
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This is a demo payment. No actual charges will be made.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardPaymentForm; 
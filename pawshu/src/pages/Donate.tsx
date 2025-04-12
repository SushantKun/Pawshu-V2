import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { showSuccessNotification, NOTIFICATIONS } from '../utils/notification';
import { XMarkIcon, CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EsewaPayment from '../components/EsewaPayment';
import CardPaymentForm from '../components/CardPaymentForm';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const XMarkIconComponent = XMarkIcon as IconComponent;
const CreditCardIconComponent = CreditCardIcon as IconComponent;
const ArrowLeftIconComponent = ArrowLeftIcon as IconComponent;

// Define the Charity interface for type safety
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

const DONATION_AMOUNTS = [100, 500, 1000, 2000, 5000];

// Helper function to safely extract charity data
function getCharityData(charity: any) {
  if (!charity) return null;
  
  // Type assertion to access properties safely
  return {
    id: charity._id || '',
    name: charity.name || '',
    description: charity.description || '',
    amount: charity.amount || 0
  };
}

const Donate = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [charities, setCharities] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [step, setStep] = useState<'select' | 'amount' | 'payment'>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [donationComplete, setDonationComplete] = useState(false);
  const [donationDetails, setDonationDetails] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'esewa' | 'khalti'>('esewa');
  const [esewaFormData, setEsewaFormData] = useState<any>(null);
  const [showEsewaPayment, setShowEsewaPayment] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [khaltiServiceError, setKhaltiServiceError] = useState(false);
  const [esewaServiceError, setEsewaServiceError] = useState(false);

  // Log changes to khaltiServiceError state
  useEffect(() => {
    console.log('khaltiServiceError changed:', khaltiServiceError);
  }, [khaltiServiceError]);

  // Fetch charities data
  useEffect(() => {
    fetchCharities();
    
    // Clear expired pending donations
    cleanupPendingDonations();
    
    // Check for donation success/failure status in URL
    const searchParams = new URLSearchParams(location.search);
    const status = searchParams.get('status');
    const donationId = searchParams.get('donationId');
    
    if (status === 'success' && donationId) {
      showSuccessNotification(
        NOTIFICATIONS.DONATION.title,
        `Your donation was processed successfully. Thank you for your support!`
      );
      setDonationComplete(true);
      fetchCharities(); // Refresh charities to show updated progress
    } else if (status === 'failed') {
      const reason = searchParams.get('reason') || 'unknown';
      toast.error(`Donation failed: ${reason}. Please try again.`);
    }
    
    // Clean up the URL
    if (status) {
      navigate('/donate', { replace: true });
    }
  }, [location.search]);

  // Function to clean up old pending donations
  const cleanupPendingDonations = () => {
    const pendingDonationStr = sessionStorage.getItem('pendingDonation');
    if (pendingDonationStr) {
      try {
        const pendingDonation = JSON.parse(pendingDonationStr);
        
        // Check if the donation has a timestamp and is older than 30 minutes
        if (pendingDonation.timestamp) {
          const now = new Date().getTime();
          const thirtyMinutesInMs = 30 * 60 * 1000;
          
          if (now - pendingDonation.timestamp > thirtyMinutesInMs) {
            console.log('Clearing expired pending donation');
            sessionStorage.removeItem('pendingDonation');
          }
        } else {
          // If no timestamp, it's from the old format, we should remove it
          console.log('Clearing old-format pending donation');
          sessionStorage.removeItem('pendingDonation');
        }
      } catch (e) {
        console.error('Error parsing pending donation during cleanup:', e);
        sessionStorage.removeItem('pendingDonation');
      }
    }
  };

  const fetchCharities = async () => {
    try {
      const response = await api.get<Charity[]>('/charities', {
        params: {
          _t: new Date().getTime(), // Cache busting to ensure we get the latest data
          refresh: true // Request server to refresh charity progress from donations
        }
      });
      
      // Map the charities and ensure progress calculations
      const charities = response.data.map(charity => ({
        ...charity,
        raised: charity.raised || 0, // Ensure raised is never undefined
        // Ensure goal is never zero to avoid division by zero
        goal: charity.goal || 1
      }));
      
      setCharities(charities);
    } catch (error) {
      console.error('Error fetching charities:', error);
      toast.error('Failed to load charities. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmount = (value: number) => {
    setCustomAmount(value.toString());
    setSelectedAmount(null);
  };

  const proceedToPayment = () => {
    if (!selectedCharity) {
      toast.error('Please select a charity');
      return;
    }

    const amount = selectedAmount || parseInt(customAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid donation amount');
      return;
    }

    if (!user) {
      toast.info('Please log in to make a donation');
      navigate('/login', { state: { from: '/donate' } });
      return;
    }

    setStep('payment');
  };

  const handlePaymentMethodChange = (method: 'card' | 'esewa' | 'khalti') => {
    setPaymentMethod(method);
    // Reset service error states when switching payment methods
    if (method !== 'khalti') {
      setKhaltiServiceError(false);
    }
    if (method !== 'esewa') {
      setEsewaServiceError(false);
    }
  };

  const initiateDirectEsewaPayment = async (charityId: string, amount: number) => {
    try {
      setIsProcessing(true);
      
      // Check if there's already a pending donation in storage
      const existingDonation = sessionStorage.getItem('pendingDonation');
      let donationId: string | null = null;
      
      if (existingDonation) {
        try {
          const pendingDonation = JSON.parse(existingDonation);
          // If we have a donation that matches the current request, reuse it
          if (pendingDonation.charityId === charityId && 
              pendingDonation.amount === amount &&
              pendingDonation.donationId &&
              pendingDonation.paymentMethod === 'esewa') {
            donationId = pendingDonation.donationId;
            console.log('Reusing existing pending eSewa donation:', donationId);
          }
        } catch (e) {
          console.error('Error parsing existing donation:', e);
        }
      }
      
      // If no existing donation found, create a new one
      if (!donationId) {
        // First create a pending donation
        const donationResponse = await api.post('/donations', {
          charityId: charityId,
          charityName: selectedCharity?.name,
          amount,
          status: 'pending',
          paymentMethod: 'esewa'
        });
        
        if (!donationResponse.data || !donationResponse.data._id) {
          toast.error('Failed to initialize donation. Please try again.');
          setIsProcessing(false);
          return;
        }
        
        donationId = donationResponse.data._id;
      }
      
      // Then get eSewa payment data from server
      const esewaResponse = await api.post('/donations/esewa-payment', {
        donationId: donationId,
        amount
      });
      
      if (esewaResponse.data && esewaResponse.data.formData) {
        // Store the donation info for completion after redirect
        sessionStorage.setItem('pendingDonation', JSON.stringify({
          donationId: donationId,
          charityId,
          charityName: selectedCharity?.name,
          amount,
          paymentMethod: 'esewa',
          timestamp: new Date().getTime() // Add timestamp to track when created
        }));
        
        // Set state to trigger eSewa payment component render
        setEsewaFormData(esewaResponse.data.formData);
        setShowEsewaPayment(true);
      } else {
        toast.error('Failed to initialize eSewa payment. Please try again.');
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('Error initiating eSewa payment:', error);
      
      // Check for service unavailable error (503 or 504)
      if (error.response && (error.response.status === 503 || error.response.status === 504)) {
        setEsewaServiceError(true);
        toast.error('eSewa payment service is currently unavailable or not responding. Please try card payment or Khalti instead.');
      } else {
        toast.error('Failed to initialize payment. Please try again.');
      }
      
      setIsProcessing(false);
    }
  };

  const initiateKhaltiPayment = async (charityId: string, amount: number) => {
    try {
      setIsProcessing(true);
      console.log('Starting Khalti payment process');
      
      // Check if there's already a pending donation in storage
      const existingDonation = sessionStorage.getItem('pendingDonation');
      let donationId: string | null = null;
      
      if (existingDonation) {
        try {
          const pendingDonation = JSON.parse(existingDonation);
          // If we have a donation that matches the current request, reuse it
          if (pendingDonation.charityId === charityId && 
              pendingDonation.amount === amount &&
              pendingDonation.donationId) {
            donationId = pendingDonation.donationId;
            console.log('Reusing existing pending donation:', donationId);
          }
        } catch (e) {
          console.error('Error parsing existing donation:', e);
        }
      }
      
      // If no existing donation found, create a new one
      if (!donationId) {
        // First create a pending donation
        const donationResponse = await api.post('/donations', {
          charityId: charityId,
          charityName: selectedCharity?.name,
          amount,
          status: 'pending',
          paymentMethod: 'khalti'
        });
        
        if (!donationResponse.data || !donationResponse.data._id) {
          toast.error('Failed to initialize donation. Please try again.');
          setIsProcessing(false);
          return;
        }
        
        donationId = donationResponse.data._id;
      }
      
      // Then initiate Khalti payment with the donation ID
      const khaltiResponse = await api.post('/donations/khalti-payment', {
        donationId: donationId,
        amount,
        charityId
      });
      
      // If successful, redirect to Khalti payment URL
      if (khaltiResponse.data && khaltiResponse.data.paymentUrl) {
        // Store donation info in sessionStorage
        sessionStorage.setItem('pendingDonation', JSON.stringify({
          donationId: donationId,
          charityId,
          charityName: selectedCharity?.name,
          amount,
          paymentMethod: 'khalti',
          timestamp: new Date().getTime() // Add timestamp to know when this was created
        }));
        
        // Redirect to Khalti payment page
        window.location.href = khaltiResponse.data.paymentUrl;
      } else {
        toast.error('Failed to initialize Khalti payment. Please try again.');
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('Error initiating Khalti payment:', error);
      
      // Check for service unavailable error (503 or 504)
      if (error.response && (error.response.status === 503 || error.response.status === 504)) {
        console.log('Setting khaltiServiceError to true due to', error.response.status, 'error');
        setKhaltiServiceError(true);
        toast.error('Khalti payment service is currently unavailable or not responding. Please try eSewa or card payment instead.');
      } else {
        toast.error('Failed to initialize Khalti payment. Please try again.');
      }
      
      setIsProcessing(false);
    }
  };

  const handleDonation = async () => {
    if (!selectedCharity) {
      toast.error('Please select a charity');
      return;
    }
    
    if (!user) {
      toast.info('Please log in to make a donation');
      navigate('/login', { state: { from: '/donate' } });
      return;
    }

    const amount = selectedAmount || parseInt(customAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid donation amount');
      return;
    }

    try {
      setIsProcessing(true);
      
      if (paymentMethod === 'card') {
        // Log the charity data before showing card form
        console.log('Selected charity for card payment:', selectedCharity);
        
        // Show card form instead of automatically completing
        setShowCardForm(true);
        setIsProcessing(false);
      } else if (paymentMethod === 'esewa') {
        // Store donation info in sessionStorage so we can create it after successful payment
        sessionStorage.setItem('pendingDonation', JSON.stringify({
          charityId: selectedCharity._id,
          charityName: selectedCharity.name,
          amount
        }));
        
        // Direct to eSewa payment page (no server interaction for payment initiation)
        await initiateDirectEsewaPayment(selectedCharity._id, amount);
      } else if (paymentMethod === 'khalti') {
        // Initiate Khalti payment which handles the donation creation
        await initiateKhaltiPayment(selectedCharity._id, amount);
      }
    } catch (error) {
      console.error('Error processing donation:', error);
      toast.error('There was a problem processing your donation. Please try again.');
      setIsProcessing(false);
    }
  };

  const processCardPayment = () => {
    console.log("Card payment button clicked directly");
    
    if (!selectedCharity) {
      toast.error('Please select a charity');
      return;
    }
    
    // Validate card details
    if (!cardNumber || !cardExpiry || !cardCvv) {
      toast.error('Please fill in all card details');
      return;
    }
    
    // Simple validation for demo purposes
    if (cardNumber.length < 16 || cardExpiry.length < 4 || cardCvv.length < 3) {
      toast.error('Please enter valid card details');
      return;
    }
    
    setIsProcessing(true);
    console.log("Processing card payment");
    
    // Ensure charity is properly typed
    const charity = selectedCharity;
    
    if (!charity || !charity._id) {
      toast.error('Invalid charity selection');
      setIsProcessing(false);
      return;
    }
    
    // Get amount from either selected amount or custom amount
    const amount = selectedAmount || parseInt(customAmount);
    
    // Prepare donation data with proper fields for the API
    const donationData = {
      charityId: charity._id,
      charityName: charity.name,
      amount,
      status: 'completed',
      paymentMethod: 'card',
      cardDetails: {
        cardNumber,
        cardExpiry,
        cardCvv
      }
    };
    
    console.log("Processing donation with data:", {...donationData, cardDetails: "REDACTED"});
    
    // Use the proper API client
    api.post('/donations/card-payment', donationData)
      .then(response => {
        console.log("Donation successful:", response.data);
        if (response.data.donation) {
          setDonationDetails(response.data.donation);
          setDonationComplete(true);
          setShowCardForm(false);
          
          showSuccessNotification(
            NOTIFICATIONS.DONATION.title,
            `Thank you for your donation of NPR ${amount.toLocaleString()} to ${charity.name}!`
          );
          
          // Refresh charities to show updated progress
          fetchCharities();
        } else {
          toast.error('Donation response was invalid. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error processing card payment:', error);
        toast.error('There was a problem processing your payment. Please try again.');
      })
      .finally(() => {
        setIsProcessing(false);
      });
  };

  useEffect(() => {
    // Check for pending donation in sessionStorage and success status in URL
    const searchParams = new URLSearchParams(location.search);
    const status = searchParams.get('status');
    const donationId = searchParams.get('donationId');
    
    const pendingDonationStr = sessionStorage.getItem('pendingDonation');
    
    if (status === 'success' && (donationId || pendingDonationStr)) {
      // Process successful payment
      const pendingDonation = pendingDonationStr ? JSON.parse(pendingDonationStr) : null;
      
      const createOrCompleteDonation = async () => {
        try {
          setIsProcessing(true);
          let donation;
          
          // If we have a donation ID that includes 'donation_', it's from Khalti
          if (donationId && donationId.includes('donation_')) {
            console.log('Processing Khalti payment success for:', donationId);
            const existingDonationId = donationId.replace('donation_', '');
            
            // First check if the donation exists and its status
            let existingDonation;
            try {
              const checkResponse = await api.get(`/donations/${existingDonationId}`);
              existingDonation = checkResponse.data;
            } catch (err) {
              console.error('Error checking donation status:', err);
            }
            
            // Only complete the donation if it's still pending
            if (!existingDonation || existingDonation.status !== 'completed') {
              const response = await api.put(`/donations/${existingDonationId}/complete`, {
                paymentMethod: 'khalti'
              });
              donation = response.data;
            } else {
              donation = existingDonation;
              console.log('Donation was already completed:', existingDonationId);
            }
          } 
          // For eSewa payments that created a donation before redirect
          else if (pendingDonation && pendingDonation.donationId) {
            console.log('Processing eSewa payment success for existing donation:', pendingDonation.donationId);
            
            // Check if donation exists and its status
            let existingDonation;
            try {
              const checkResponse = await api.get(`/donations/${pendingDonation.donationId}`);
              existingDonation = checkResponse.data;
            } catch (err) {
              console.error('Error checking eSewa donation status:', err);
            }
            
            // Only complete if it's still pending
            if (!existingDonation || existingDonation.status !== 'completed') {
              const response = await api.put(`/donations/${pendingDonation.donationId}/complete`, {
                paymentMethod: pendingDonation.paymentMethod || 'esewa'
              });
              donation = response.data;
            } else {
              donation = existingDonation;
              console.log('eSewa donation was already completed:', pendingDonation.donationId);
            }
          } 
          // Fallback for older implementations or if no donation was created yet
          else if (pendingDonation) {
            console.log('Creating new donation for payment success with data:', pendingDonation);
            
            // For creating a new donation
            const response = await api.post('/donations', {
              charityId: pendingDonation.charityId,
              charityName: pendingDonation.charityName,
              amount: pendingDonation.amount,
              status: 'completed',
              paymentMethod: pendingDonation.paymentMethod || 'esewa'
            });
            donation = response.data;
          }
          
          if (donation) {
            setDonationDetails(donation);
            setDonationComplete(true);
            
            showSuccessNotification(
              NOTIFICATIONS.DONATION.title,
              `Thank you for your donation of NPR ${donation.amount.toLocaleString()} to ${donation.charityName}!`
            );
            
            // Refresh charities to show updated progress
            fetchCharities();
            
            // Clear the pending donation
            sessionStorage.removeItem('pendingDonation');
            
            // Update URL to remove query params
            navigate('/donate', { replace: true });
          }
        } catch (error) {
          console.error('Error completing donation after payment:', error);
          toast.error('There was a problem finalizing your donation. Please contact support.');
        } finally {
          setIsProcessing(false);
        }
      };
      
      createOrCompleteDonation();
    }
  }, [location.search]);

  // Return the eSewa payment form if we're in eSewa payment mode
  if (showEsewaPayment && esewaFormData) {
    return <EsewaPayment formData={esewaFormData} />;
  }

  // Card payment form
  if (showCardForm && selectedCharity) {
    console.log('Rendering CardPaymentForm with charity:', selectedCharity);
    
    return (
      <CardPaymentForm 
        charity={selectedCharity}
        amount={selectedAmount || parseInt(customAmount) || 0}
        onSuccess={(data) => {
          console.log('Payment successful, received data:', data);
          setDonationDetails(data);
          setDonationComplete(true);
          setShowCardForm(false);
          // Refresh charities to show updated progress
          fetchCharities();
        }}
        onCancel={() => {
          console.log('Payment cancelled');
          setShowCardForm(false);
          setStep('payment');
        }}
        fetchCharities={fetchCharities}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Support Animal Welfare</h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">Your donation makes a difference in the lives of animals in need</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
          </div>
        ) : donationComplete ? (
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
            {donationDetails && (
              <div className="mb-6 p-4 bg-gray-200 dark:bg-gray-700 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Donation Details</h3>
                <p><span className="font-medium">Amount:</span> NPR {donationDetails.amount.toLocaleString()}</p>
                <p><span className="font-medium">Charity:</span> {donationDetails.charityName}</p>
                <p><span className="font-medium">Date:</span> {
                  (() => {
                    // Try different date formats and fallback to current date
                    try {
                      if (donationDetails.createdAt) {
                        return new Date(donationDetails.createdAt).toLocaleDateString();
                      } else if (donationDetails.date) {
                        return new Date(donationDetails.date).toLocaleDateString();
                      } else {
                        return new Date().toLocaleDateString();
                      }
                    } catch (error) {
                      console.error('Error formatting date:', error);
                      return new Date().toLocaleDateString();
                    }
                  })()
                }</p>
                <p><span className="font-medium">Status:</span> <span className="text-green-500">Completed</span></p>
              </div>
            )}
            <button
              onClick={() => {
                setSelectedCharity(null);
                setDonationComplete(false);
                setDonationDetails(null);
                setStep('select');
                fetchCharities();
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
            >
              Donate to Another Cause
            </button>
          </div>
        ) : step === 'payment' ? (
          <div className="max-w-md mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setStep('select')}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mr-2"
                >
                  <ArrowLeftIconComponent className="h-5 w-5" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Method</h2>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {selectedCharity?.name}
              </h3>
              <p className="text-md font-medium text-gray-800 dark:text-gray-200">
                Donation Amount: NPR {(selectedAmount || parseInt(customAmount)).toLocaleString()}
              </p>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Choose your payment method:
              </p>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <button
                  onClick={() => handlePaymentMethodChange('card')}
                  className={`flex items-center justify-center p-4 border rounded-lg ${
                    paymentMethod === 'card'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <CreditCardIconComponent className="h-6 w-6 mr-2" />
                  <span>Card</span>
                </button>
                
                <button
                  onClick={() => handlePaymentMethodChange('esewa')}
                  className={`flex items-center justify-center p-4 border rounded-lg ${
                    paymentMethod === 'esewa'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <img
                    src="/esewa-logo.png"
                    alt="eSewa Logo"
                    className="h-6 w-6 mr-2"
                    onError={(e) => {
                      // Fallback if esewa logo is missing
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.style.display = 'none';
                    }}
                  />
                  <div className="flex flex-col items-start">
                    <span>eSewa</span>
                    {esewaServiceError && (
                      <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap">
                        ⚠️ Service unavailable
                      </span>
                    )}
                  </div>
                </button>
                
                <button
                  onClick={() => handlePaymentMethodChange('khalti')}
                  className={`flex items-center justify-center p-4 border rounded-lg ${
                    paymentMethod === 'khalti'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <img
                    src="/khalti-logo.png"
                    alt="Khalti Logo"
                    className="h-6 w-6 mr-2"
                    onError={(e) => {
                      // Fallback if khalti logo is missing
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.style.display = 'none';
                    }}
                  />
                  <div className="flex flex-col items-start">
                    <span>Khalti</span>
                    {khaltiServiceError && (
                      <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap font-bold">
                        ⚠️ Service unavailable
                      </span>
                    )}
                  </div>
                </button>
              </div>
              
              {/* Add payment information panels */}
              {paymentMethod === 'card' && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Your card will be charged immediately and your donation will be processed securely.
                  </p>
                </div>
              )}
              
              {paymentMethod === 'esewa' && (
                <div className="space-y-4 mt-4">
                  {esewaServiceError && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-md">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                        ⚠️ eSewa Payment Service Unavailable
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        The eSewa payment service is currently unavailable. We recommend using Khalti or card payment instead. 
                        If you proceed with eSewa, you may encounter errors.
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      You will be redirected to eSewa to complete your payment. Once the payment is successful, you will be redirected back to this site.
                    </p>
                  </div>
                </div>
              )}
              
              {paymentMethod === 'khalti' && (
                <div className="space-y-4 mt-4">
                  {khaltiServiceError ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-md">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                        ⚠️ Khalti Payment Service Unavailable
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        The Khalti payment service is currently unavailable. We recommend using eSewa or card payment instead. 
                        If you proceed with Khalti, you may encounter errors.
                      </p>
                    </div>
                  ) : null}
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      You will be redirected to Khalti to complete your payment. Once the payment is successful, you will be redirected back to this site.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="mt-6">
                <button
                  onClick={handleDonation}
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
                    `Pay with ${paymentMethod === 'card' ? 'Credit Card' : paymentMethod === 'esewa' ? 'eSewa' : 'Khalti'}`
                  )}
                </button>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your donation is securely processed and will help animals in need.
                <br />Thank you for your generosity!
              </p>
            </div>
          </div>
        ) : selectedCharity ? (
          <div className="max-w-md mx-auto bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Make a Donation</h2>
              <button
                onClick={() => setSelectedCharity(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <XMarkIconComponent className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{selectedCharity.name}</h3>
              <p className="text-gray-600 dark:text-gray-300">{selectedCharity.description}</p>
            </div>
            
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">Progress</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedCharity.goal > 0 ? Math.round((selectedCharity.raised / selectedCharity.goal) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${selectedCharity.goal > 0 ? Math.min((selectedCharity.raised / selectedCharity.goal) * 100, 100) : 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  NPR {selectedCharity.raised.toLocaleString()}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  NPR {selectedCharity.goal.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select donation amount
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {DONATION_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAmountSelect(amount)}
                    className={`py-2 px-4 rounded-md border ${
                      selectedAmount === amount
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    NPR {amount}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => handleCustomAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring focus:ring-blue-300 dark:focus:ring-blue-700 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 dark:text-gray-400">NPR</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={proceedToPayment}
              disabled={(!selectedAmount && !customAmount) || isProcessing}
              className={`w-full py-3 px-4 rounded-lg font-semibold ${
                (!selectedAmount && !customAmount) || isProcessing
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
                'Proceed to Payment'
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Charities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {charities.map((charity: Charity) => (
                <div 
                  key={charity._id} 
                  className={`bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden cursor-pointer transform transition-transform hover:scale-105 ${
                    selectedCharity && selectedCharity._id === charity._id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedCharity(charity)}
                >
                  <img
                    src={charity.image.url}
                    alt={charity.name}
                    className="w-full h-[300px] object-cover"
                  />
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{charity.name}</h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">{charity.description}</p>
                    <div className="mt-4">
                      <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200 dark:bg-blue-900/30">
                              Progress
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-semibold inline-block py-1 px-2 rounded-full ${
                              charity.goal > 0 && (charity.raised / charity.goal) >= 1 
                                ? 'bg-green-200 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {charity.goal > 0 ? Math.min(Math.round((charity.raised / charity.goal) * 100), 100) : 0}%
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                          <div
                            style={{ width: `${charity.goal > 0 ? Math.min((charity.raised / charity.goal) * 100, 100) : 0}%` }}
                            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                              charity.goal > 0 && (charity.raised / charity.goal) >= 1 
                                ? 'bg-green-500'
                                : 'bg-blue-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Donate; 
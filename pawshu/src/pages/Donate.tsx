import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { showSuccessNotification, NOTIFICATIONS } from '../utils/notification';
import { XMarkIcon, CreditCardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const XMarkIconComponent = XMarkIcon as IconComponent;
const CreditCardIconComponent = CreditCardIcon as IconComponent;
const ArrowLeftIconComponent = ArrowLeftIcon as IconComponent;

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

const Donate = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [charities, setCharities] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [donationComplete, setDonationComplete] = useState(false);
  const [donationDetails, setDonationDetails] = useState<any>(null);
  const [step, setStep] = useState<'select' | 'payment'>('select');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'esewa' | 'khalti'>('esewa');

  // Fetch charities data
  useEffect(() => {
    fetchCharities();
    
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

  const fetchCharities = async () => {
    try {
      const response = await api.get<Charity[]>('/charities', {
        params: {
          _t: new Date().getTime() // Cache busting
        }
      });
      setCharities(response.data);
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
  };

  const initiateDirectEsewaPayment = async (charityId: string, amount: number) => {
    try {
      // We're going directly to the eSewa sandbox environment
      window.location.href = `https://esewa.com.np/#/`;
      
    } catch (error) {
      console.error('Error initiating eSewa payment:', error);
      toast.error('Failed to initialize payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const initiateKhaltiPayment = async (charityId: string, amount: number) => {
    try {
      setIsProcessing(true);
      
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
      
      // Then initiate Khalti payment with the donation ID
      const khaltiResponse = await api.post('/donations/khalti-payment', {
        donationId: donationResponse.data._id,
        amount,
        charityId
      });
      
      // If successful, redirect to Khalti payment URL
      if (khaltiResponse.data && khaltiResponse.data.paymentUrl) {
        // Store donation info in sessionStorage
        sessionStorage.setItem('pendingDonation', JSON.stringify({
          donationId: donationResponse.data._id,
          charityId,
          charityName: selectedCharity?.name,
          amount
        }));
        
        // Redirect to Khalti payment page
        window.location.href = khaltiResponse.data.paymentUrl;
      } else {
        toast.error('Failed to initialize Khalti payment. Please try again.');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error initiating Khalti payment:', error);
      toast.error('Failed to initialize payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleDonation = async () => {
    if (!selectedCharity) return;
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
        // For card payment, create and complete the donation directly
        const response = await api.post('/donations', {
          charityId: selectedCharity._id,
          charityName: selectedCharity.name,
          amount,
          status: 'completed',
          paymentMethod: 'card'
        });
        
        setDonationDetails(response.data);
        setDonationComplete(true);
        
        showSuccessNotification(
          NOTIFICATIONS.DONATION.title,
          `Thank you for your donation of NPR ${amount.toLocaleString()} to ${selectedCharity.name}!`
        );
        
        // Refresh charities to show updated progress
        fetchCharities();
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
          let donation;
          
          // If we have a donation ID, it means it's a Khalti payment that already created the donation
          if (donationId && donationId.startsWith('donation_')) {
            // For an existing donation (Khalti), complete it
            const existingDonationId = donationId.replace('donation_', '');
            const response = await api.put(`/donations/${existingDonationId}/complete`, {
              paymentMethod: 'khalti'
            });
            donation = response.data.donation;
          } else if (pendingDonation) {
            // For eSewa or creating a new donation
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
        }
      };
      
      createOrCompleteDonation();
    }
  }, [location.search]);

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
                <p><span className="font-medium">Date:</span> {new Date(donationDetails.createdAt).toLocaleDateString()}</p>
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
                  <span>eSewa</span>
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
                  <span>Khalti</span>
                </button>
              </div>
              
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
                  {Math.round((selectedCharity.raised / selectedCharity.goal) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min((selectedCharity.raised / selectedCharity.goal) * 100, 100)}%` }}
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
                    selectedCharity?._id === charity._id ? 'ring-2 ring-blue-500' : ''
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
                              (charity.raised / charity.goal) >= 1 
                                ? 'bg-green-200 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {Math.min(Math.round((charity.raised / charity.goal) * 100), 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                          <div
                            style={{ width: `${Math.min((charity.raised / charity.goal) * 100, 100)}%` }}
                            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                              (charity.raised / charity.goal) >= 1 
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
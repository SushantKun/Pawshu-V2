import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { showSuccessNotification, NOTIFICATIONS } from '../utils/notification';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const XMarkIconComponent = XMarkIcon as IconComponent;

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

interface PaymentDetails {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
}

interface PaymentValidation {
  cardNumber: boolean;
  expiryDate: boolean;
  cvv: boolean;
}

const Donate = () => {
  const { user } = useAuth();
  const [charities, setCharities] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    cardNumber: '',
    expiryDate: '',
    cvv: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<PaymentValidation>({
    cardNumber: true,
    expiryDate: true,
    cvv: true
  });
  const [donationComplete, setDonationComplete] = useState(false);

  // Fetch charities data
  useEffect(() => {
    fetchCharities();
  }, []);

  const fetchCharities = async () => {
    try {
      const response = await api.get<Charity[]>('/charities');
      setCharities(response.data);
    } catch (error) {
      console.error('Error fetching charities:', error);
      toast.error('Failed to load charities. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Update charity progress after successful donation
  const updateCharityProgress = async (charityId: string, amount: number) => {
    try {
      const response = await api.put(`/charities/${charityId}/progress`, { amount });
      setCharities(prevCharities => 
        prevCharities.map(charity => 
          charity._id === charityId 
            ? { ...charity, raised: response.data.raised }
            : charity
        )
      );
    } catch (error) {
      console.error('Error updating charity progress:', error);
    }
  };

  const handleProceedToPayment = () => {
    if (!selectedCharity || (!selectedAmount && !customAmount)) return;
    setShowPaymentForm(true);
  };

  const validateCardNumber = (number: string) => {
    const cleaned = number.replace(/\s/g, '');
    return cleaned.length === 16 && /^\d+$/.test(cleaned);
  };

  const validateExpiryDate = (date: string) => {
    if (!/^\d{2}\/\d{2}$/.test(date)) return false;
    
    const [month, year] = date.split('/').map(num => parseInt(num));
    const now = new Date();
    const currentYear = parseInt(now.getFullYear().toString().slice(-2));
    const currentMonth = now.getMonth() + 1;

    if (month < 1 || month > 12) return false;
    if (year < currentYear) return false;
    if (year === currentYear && month < currentMonth) return false;
    
    return true;
  };

  const validateCVV = (cvv: string) => {
    return /^\d{3}$/.test(cvv);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setPaymentDetails(prev => ({ ...prev, cardNumber: formatted }));
    setValidationErrors(prev => ({
      ...prev,
      cardNumber: validateCardNumber(formatted)
    }));
  };

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Auto-format MM/YY
    if (value.length === 2 && paymentDetails.expiryDate.length === 1) {
      value += '/';
    }
    
    setPaymentDetails(prev => ({ ...prev, expiryDate: value }));
    setValidationErrors(prev => ({
      ...prev,
      expiryDate: validateExpiryDate(value)
    }));
  };

  const handleCVVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPaymentDetails(prev => ({ ...prev, cvv: value }));
    setValidationErrors(prev => ({
      ...prev,
      cvv: validateCVV(value)
    }));
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmount = (value: number) => {
    setCustomAmount(value.toString());
    setSelectedAmount(null);
  };

  const handleDonationSubmit = async () => {
    if (!selectedCharity) return;

    const amount = selectedAmount || parseInt(customAmount);
    if (!amount) return;

    try {
      setLoading(true);
      await api.post('/donations', {
        charityId: selectedCharity._id,
        charityName: selectedCharity.name,
        amount
      });

      showSuccessNotification(
        NOTIFICATIONS.DONATION.title,
        `Your support of Rs. ${amount} helps make a difference for animals in need.`
      );
      setDonationComplete(true);
      fetchCharities(); // Refresh charities to update progress
    } catch (error) {
      console.error('Error processing donation:', error);
      showErrorNotification(
        'Donation Failed',
        'There was an error processing your donation. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const showErrorNotification = (title: string, message: string) => {
    toast.error(message, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
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
              Your generous contribution of Rs. {selectedAmount ? selectedAmount.toLocaleString() : customAmount} to {selectedCharity?.name} will make a difference.
            </p>
            <button
              onClick={() => setSelectedCharity(null)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
            >
              Donate to Another Cause
            </button>
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
                  Rs. {selectedCharity.raised.toLocaleString()}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Rs. {selectedCharity.goal.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Select Amount</h4>
              <div className="grid grid-cols-3 gap-3">
                {[500, 1000, 2000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAmountSelect(amount)}
                    className={`py-2 px-4 rounded-lg font-medium ${
                      selectedAmount === amount
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Rs. {amount}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <label htmlFor="customAmount" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Or enter custom amount
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400">
                  Rs.
                </span>
                <input
                  type="number"
                  id="customAmount"
                  value={customAmount}
                  onChange={(e) => handleCustomAmount(parseInt(e.target.value))}
                  className="block w-full pl-12 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter amount"
                />
              </div>
            </div>
            
            <button
              onClick={handleDonationSubmit}
              disabled={!selectedAmount && !customAmount}
              className={`w-full py-3 px-4 rounded-lg font-semibold ${
                !selectedAmount && !customAmount
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="ml-2">Processing...</span>
                </div>
              ) : (
                'Complete Donation'
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Charities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {charities.map((charity) => (
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
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import api from '../api/axios';

interface Charity {
  id: number;
  name: string;
  description: string;
  image: string;
  goal: number;
  raised: number;
}

const SAMPLE_CHARITIES: Charity[] = [
  {
    id: 1,
    name: "Nepal Animal Shelter",
    description: "Supporting stray animals with food, shelter, and medical care. Your donation helps us provide essential care for abandoned pets.",
    image: "https://placehold.co/400x300",
    goal: 50000,
    raised: 35000
  },
  {
    id: 2,
    name: "Street Dog Welfare",
    description: "Providing vaccinations and medical treatment for street dogs. Help us create a healthier environment for street animals.",
    image: "https://placehold.co/400x300",
    goal: 30000,
    raised: 15000
  },
  {
    id: 3,
    name: "Cat Protection Nepal",
    description: "Rescuing and rehabilitating abandoned cats. Your support helps us find forever homes for rescued cats.",
    image: "https://placehold.co/400x300",
    goal: 25000,
    raised: 20000
  }
];

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

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to make a donation');
      return;
    }

    // Validate all fields
    const isCardValid = validateCardNumber(paymentDetails.cardNumber);
    const isExpiryValid = validateExpiryDate(paymentDetails.expiryDate);
    const isCVVValid = validateCVV(paymentDetails.cvv);

    setValidationErrors({
      cardNumber: isCardValid,
      expiryDate: isExpiryValid,
      cvv: isCVVValid
    });

    if (!isCardValid || !isExpiryValid || !isCVVValid) {
      toast.error('Please check your payment details');
      return;
    }

    const donationAmount = customAmount ? parseInt(customAmount) : selectedAmount;
    if (!donationAmount || !selectedCharity) return;

    setIsProcessing(true);

    try {
      // Send donation to backend using our configured axios instance
      await api.post('/donations', {
        charityId: selectedCharity.id,
        charityName: selectedCharity.name,
        amount: donationAmount,
        userId: user._id,
        userName: user.name,
        date: new Date().toISOString()
      });

      // Show custom success notification
      toast.success(
        <div className="text-center">
          <h4 className="text-lg font-semibold mb-2">Thank You for Your Donation!</h4>
          <p>Your support helps make a difference for animals in need.</p>
          <p className="mt-2 font-medium">Amount: Rs. {donationAmount}</p>
        </div>,
        {
          autoClose: 5000,
          className: "bg-white shadow-lg rounded-lg p-4"
        }
      );

      // Reset form
      setSelectedCharity(null);
      setSelectedAmount(null);
      setCustomAmount('');
      setShowPaymentForm(false);
      setPaymentDetails({
        cardNumber: '',
        expiryDate: '',
        cvv: ''
      });
    } catch (error) {
      console.error('Payment failed:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Support Animal Welfare</h1>
          <p className="mt-4 text-xl text-gray-600">Your donation makes a difference in the lives of animals in need</p>
        </div>

        {!showPaymentForm ? (
          <>
            {/* Charities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {SAMPLE_CHARITIES.map(charity => (
                <div 
                  key={charity.id} 
                  className={`bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer transform transition-transform hover:scale-105 ${
                    selectedCharity?.id === charity.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedCharity(charity)}
                >
                  <img
                    src={charity.image}
                    alt={charity.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900">{charity.name}</h3>
                    <p className="mt-2 text-gray-600">{charity.description}</p>
                    <div className="mt-4">
                      <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                              Progress
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold inline-block text-blue-600">
                              {Math.round((charity.raised / charity.goal) * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                          <div
                            style={{ width: `${(charity.raised / charity.goal) * 100}%` }}
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                          />
                        </div>
                        <div className="text-sm text-gray-600">
                          Rs. {charity.raised.toLocaleString()} raised of Rs. {charity.goal.toLocaleString()} goal
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Donation Amount Selection */}
            {selectedCharity && (
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Donate to {selectedCharity.name}
                </h3>

                {/* Predefined amounts */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                  {DONATION_AMOUNTS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => {
                        setSelectedAmount(amount);
                        setCustomAmount('');
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        selectedAmount === amount
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Rs. {amount}
                    </button>
                  ))}
                </div>

                {/* Custom amount input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Amount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmount(null);
                    }}
                    min="1"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter custom amount"
                  />
                </div>

                {/* Proceed to Payment button */}
                <button
                  onClick={handleProceedToPayment}
                  disabled={!selectedCharity || (!selectedAmount && !customAmount)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Proceed to Payment
                </button>
              </div>
            )}
          </>
        ) : (
          /* Payment Form */
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Payment Details</h3>
              <div className="text-right">
                <p className="text-sm text-gray-600">Amount:</p>
                <p className="text-lg font-semibold text-blue-600">
                  Rs. {customAmount || selectedAmount}
                </p>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Number
                </label>
                <input
                  type="text"
                  value={paymentDetails.cardNumber}
                  onChange={handleCardNumberChange}
                  maxLength={19}
                  className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    !validationErrors.cardNumber && paymentDetails.cardNumber
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="1234 5678 9012 3456"
                  required
                />
                {!validationErrors.cardNumber && paymentDetails.cardNumber && (
                  <p className="mt-1 text-sm text-red-600">
                    Please enter a valid 16-digit card number
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={paymentDetails.expiryDate}
                    onChange={handleExpiryDateChange}
                    className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                      !validationErrors.expiryDate && paymentDetails.expiryDate
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                    placeholder="MM/YY"
                    maxLength={5}
                    required
                  />
                  {!validationErrors.expiryDate && paymentDetails.expiryDate && (
                    <p className="mt-1 text-sm text-red-600">
                      Please enter a valid expiry date (MM/YY)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CVV
                  </label>
                  <input
                    type="password"
                    value={paymentDetails.cvv}
                    onChange={handleCVVChange}
                    className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                      !validationErrors.cvv && paymentDetails.cvv
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                    placeholder="123"
                    maxLength={3}
                    required
                  />
                  {!validationErrors.cvv && paymentDetails.cvv && (
                    <p className="mt-1 text-sm text-red-600">
                      Please enter a valid 3-digit CVV
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Complete Donation'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Donate; 
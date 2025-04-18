import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const EmailVerification: React.FC = () => {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState<string>('Verifying your email...');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isCodeMode, setIsCodeMode] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { darkMode } = useTheme();

  useEffect(() => {
    // Get email from location state if available
    if (location.state?.email) {
      setEmail(location.state.email);
    }

    const verifyEmailWithToken = async () => {
      const query = new URLSearchParams(location.search);
      const token = query.get('token');

      if (!token) {
        setIsCodeMode(true);
        setVerificationStatus('failed');
        setMessage('No verification token found. Please enter your email and verification code below.');
        return;
      }

      try {
        const response = await axios.get(`/auth/verify-email/${token}`);
        if (response.data.success) {
          setVerificationStatus('success');
          setMessage('Your email has been successfully verified! You will be redirected to the login page shortly.');
          setTimeout(() => {
            navigate('/login', { state: { verified: true } });
          }, 3000);
        } else {
          setVerificationStatus('failed');
          setMessage('Email verification failed. The link may have expired. Please try again or request a new verification link.');
          setIsCodeMode(true);
        }
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationStatus('failed');
        setMessage('Email verification failed. The link may have expired. Please try again or request a new verification link.');
        setIsCodeMode(true);
      }
    };

    // If there's a token in the URL, verify with token
    const query = new URLSearchParams(location.search);
    if (query.get('token')) {
      verifyEmailWithToken();
    } else {
      // Otherwise, show the code input form
      setIsCodeMode(true);
      setVerificationStatus('failed');
      setMessage('Please enter your email and verification code below.');
    }
  }, [location.search, navigate, location.state]);

  const handleVerifyWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !verificationCode) {
      setMessage('Email and verification code are required.');
      return;
    }

    try {
      setVerificationStatus('loading');
      setMessage('Verifying your email...');
      
      const response = await axios.post('/auth/verify-email-code', {
        email,
        code: verificationCode
      });

      if (response.data.success) {
        setVerificationStatus('success');
        setMessage('Your email has been successfully verified! You will be redirected to the login page shortly.');
        setTimeout(() => {
          navigate('/login', { state: { verified: true } });
        }, 3000);
      } else {
        setVerificationStatus('failed');
        setMessage('Verification failed. Please check your code and try again.');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setVerificationStatus('failed');
      setMessage(error.response?.data?.message || 'Verification failed. Please check your code and try again.');
    }
  };

  const handleResendVerification = async (type: 'link' | 'code') => {
    if (!email) {
      setMessage('Please enter your email address to resend verification.');
      return;
    }

    try {
      setIsResending(true);
      const response = await axios.post('/auth/resend-verification', {
        email,
        verificationType: type
      });

      setMessage(response.data.message);
      setIsResending(false);
    } catch (error: any) {
      console.error('Error resending verification:', error);
      setMessage(error.response?.data?.message || 'Failed to resend verification. Please try again.');
      setIsResending(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} py-12 px-4 sm:px-6 lg:px-8`}>
      <div className={`max-w-md w-full space-y-8 ${darkMode ? 'bg-gray-800' : 'bg-white'} p-8 rounded-lg shadow-md`}>
        <h1 className={`text-2xl font-bold text-center mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Email Verification
        </h1>
        
        {verificationStatus === 'loading' && !isCodeMode && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{message}</p>
          </div>
        )}
        
        {verificationStatus === 'success' && (
          <div className="text-center">
            <div className={`${darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'} p-4 rounded-lg mb-4`}>
              <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p>{message}</p>
            </div>
          </div>
        )}
        
        {(verificationStatus === 'failed' || isCodeMode) && (
          <div>
            {message && (
              <div className={`p-4 rounded-lg mb-6 ${
                verificationStatus === 'failed' 
                  ? darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700'
                  : darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
              }`}>
                <p>{message}</p>
              </div>
            )}
            
            <form onSubmit={handleVerifyWithCode} className="space-y-4">
              <div>
                <label htmlFor="email" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'border-gray-300 placeholder-gray-500'
                  }`}
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="code" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Verification Code
                </label>
                <input
                  type="text"
                  id="code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'border-gray-300 placeholder-gray-500'
                  }`}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Verify Email
              </button>
            </form>
            
            <div className="mt-6">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                Didn't receive the verification?
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleResendVerification('code')}
                  disabled={isResending}
                  className={`text-sm ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} disabled:opacity-50`}
                >
                  {isResending ? 'Sending...' : 'Resend Code'}
                </button>
                <button
                  onClick={() => handleResendVerification('link')}
                  disabled={isResending}
                  className={`text-sm ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} disabled:opacity-50`}
                >
                  {isResending ? 'Sending...' : 'Send Link Instead'}
                </button>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/login')}
                className={`text-sm ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'}`}
              >
                Back to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerification; 
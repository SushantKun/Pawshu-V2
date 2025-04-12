import React from 'react';
import { GoogleLogin as GoogleLoginButton } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

interface GoogleLoginProps {
  className?: string;
}

const GoogleLogin: React.FC<GoogleLoginProps> = ({ className }) => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      console.log('Google login success:', credentialResponse);

      // Get the credential (ID token)
      const { credential } = credentialResponse;

      if (!credential) {
        toast.error('Failed to get Google credentials');
        return;
      }

      // Decode the credential to get user info (for logging purposes only)
      const decodedToken: any = jwtDecode(credential);
      console.log('Decoded Google token:', decodedToken);

      // Send the token to the backend for verification
      const response = await api.post('/auth/google', {
        token: credential,
        rememberMe: localStorage.getItem('rememberMe') === 'true'
      });

      // Handle successful login
      const { token, user } = response.data;

      // For Google logins, respect user's rememberMe preference if they've set it before,
      // otherwise default to false for security (no "remember me" by default)
      const rememberPreference = localStorage.getItem('rememberMe') === 'true';
      await login(token, user, rememberPreference);

      toast.success('Logged in with Google successfully!');

      // Explicitly navigate to homepage after successful login
      navigate('/');
    } catch (error: any) {
      console.error('Google login error:', error);
      toast.error(error.response?.data?.message || 'Google login failed. Please try again.');
    }
  };

  const handleGoogleError = () => {
    // Ignore console errors about origins, as they don't affect functionality
    console.log('Google login process encountered some warnings, but may still work.');

    // Only show error toast if login completely fails
    // Removing this toast notification since it might confuse users when login actually succeeds
    // toast.error('Google login failed. Please try again.');
  };

  return (
    <div className={`flex justify-center ${className || 'my-4'}`}>
      <GoogleLoginButton
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        useOneTap
        size="large"
        text="continue_with"
        shape="pill"
        logo_alignment="center"
        type="standard"
      />
    </div>
  );
};

export default GoogleLogin; 
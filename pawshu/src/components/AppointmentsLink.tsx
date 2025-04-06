import { useNavigate } from 'react-router-dom';
import React, { useEffect } from 'react';

interface AppointmentsLinkProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

// Create a custom event that will be dispatched to notify the Profile component to switch tabs
const createTabChangeEvent = () => {
  return new CustomEvent('switchToAppointmentsTab', { 
    bubbles: true,
    detail: { tab: 'appointments' }
  });
};

const AppointmentsLink: React.FC<AppointmentsLinkProps> = ({ 
  children, 
  className,
  onClick
}) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Set a flag in sessionStorage (more temporary than localStorage)
    sessionStorage.setItem('activeTab', 'appointments');
    
    // Navigate to the profile page
    navigate('/profile');
    
    // Dispatch our custom event after navigation
    setTimeout(() => {
      window.dispatchEvent(createTabChangeEvent());
    }, 100);
    
    // Call the optional onClick handler if provided
    if (onClick) onClick();
  };

  return (
    <a
      href="/profile"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
};

export default AppointmentsLink; 
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { SunIcon as SunIconOutline, MoonIcon as MoonIconOutline } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const SunIcon = SunIconOutline as IconComponent;
const MoonIcon = MoonIconOutline as IconComponent;

interface DoctorInfo {
  firstName: string;
  lastName: string;
  specialization: string;
  profileImage?: {
    url: string;
  };
}

const DoctorSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const { darkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    // Get doctor info from localStorage
    const storedInfo = localStorage.getItem('doctorInfo');
    if (storedInfo) {
      try {
        setDoctorInfo(JSON.parse(storedInfo));
      } catch (error) {
        console.error('Error parsing doctor info:', error);
      }
    }
  }, []);

  const isActive = (path: string) => {
    return location.pathname.includes(path) ? 'bg-blue-700 dark:bg-blue-800' : '';
  };

  const handleLogout = () => {
    // Clear doctor data from localStorage
    localStorage.removeItem('doctorToken');
    localStorage.removeItem('doctorInfo');
    
    // Redirect to login page
    navigate('/doctor/login');
  };

  return (
    <div className="fixed top-0 left-0 w-64 bg-blue-800 dark:bg-gray-800 text-white flex flex-col h-screen">
      <div className="p-4 border-b border-blue-700 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {doctorInfo?.profileImage?.url ? (
              <img 
                src={doctorInfo.profileImage.url} 
                alt="Doctor" 
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-blue-600 dark:bg-blue-700 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {doctorInfo?.firstName?.charAt(0) || 'D'}
                  {doctorInfo?.lastName?.charAt(0) || 'R'}
                </span>
              </div>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold">
              Dr. {doctorInfo?.firstName || ''} {doctorInfo?.lastName || ''}
            </h2>
            <p className="text-xs text-blue-300 dark:text-blue-200">{doctorInfo?.specialization || 'Veterinarian'}</p>
          </div>
        </div>
        <button 
          onClick={toggleDarkMode}
          className="p-1 rounded-full text-white hover:bg-blue-700 dark:hover:bg-gray-700 focus:outline-none"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-blue-700 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <ul className="space-y-2 px-2">
          <li>
            <Link 
              to="/doctor/dashboard" 
              className={`flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${isActive('/doctor/dashboard')}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
          </li>
          <li>
            <Link 
              to="/doctor/appointments" 
              className={`flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${isActive('/doctor/appointments')}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Appointments
            </Link>
          </li>
          <li>
            <Link 
              to="/doctor/profile" 
              className={`flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${isActive('/doctor/profile')}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Profile
            </Link>
          </li>
        </ul>
      </nav>
      
      <div className="p-4 border-t border-blue-700 dark:border-gray-700">
        <button 
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
};

export default DoctorSidebar; 
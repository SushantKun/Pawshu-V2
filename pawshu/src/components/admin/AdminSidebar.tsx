import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { SunIcon as SunIconOutline, MoonIcon as MoonIconOutline } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const SunIcon = SunIconOutline as IconComponent;
const MoonIcon = MoonIconOutline as IconComponent;

const AdminSidebar = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    // Clear admin token from localStorage
    localStorage.removeItem('adminToken');
    
    // Redirect to login page
    navigate('/admin/login');
  };
  
  return (
    <div className="fixed top-0 left-0 w-64 bg-blue-800 dark:bg-gray-800 text-white flex flex-col h-screen">
      <div className="p-4 border-b border-blue-700 dark:border-gray-700 flex justify-between items-center">
        <h2 className="font-bold text-white">Admin Panel</h2>
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
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${
                  isActive ? 'bg-blue-700 dark:bg-gray-700' : ''
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/stats"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${
                  isActive ? 'bg-blue-700 dark:bg-gray-700' : ''
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Statistics</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/products"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${
                  isActive ? 'bg-blue-700 dark:bg-gray-700' : ''
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>Products</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/charities"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${
                  isActive ? 'bg-blue-700 dark:bg-gray-700' : ''
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>Charities</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${
                  isActive ? 'bg-blue-700 dark:bg-gray-700' : ''
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Users</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/doctors"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${
                  isActive ? 'bg-blue-700 dark:bg-gray-700' : ''
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Doctors</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/orders"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${
                  isActive ? 'bg-blue-700 dark:bg-gray-700' : ''
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>Orders</span>
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-white hover:bg-blue-700 dark:hover:bg-gray-700 rounded-lg ${
                  isActive ? 'bg-blue-700 dark:bg-gray-700' : ''
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
            </NavLink>
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

export default AdminSidebar; 
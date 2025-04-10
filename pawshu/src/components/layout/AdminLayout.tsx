import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, ShoppingBagIcon, ChartBarIcon, UserIcon, CogIcon, UserGroupIcon, HeartIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useEffect } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const HomeIconComponent = HomeIcon as IconComponent;
const ShoppingBagIconComponent = ShoppingBagIcon as IconComponent;
const ChartBarIconComponent = ChartBarIcon as IconComponent;
const UserIconComponent = UserIcon as IconComponent;
const CogIconComponent = CogIcon as IconComponent;
const UserGroupIconComponent = UserGroupIcon as IconComponent;
const HeartIconComponent = HeartIcon as IconComponent;
const SunIconComponent = SunIcon as IconComponent;
const MoonIconComponent = MoonIcon as IconComponent;

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { darkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const isActive = (path: string) => {
    return currentPath.includes(path) ? 'bg-blue-700' : '';
  };

  const handleLogout = () => {
    // Remove admin token
    localStorage.removeItem('adminToken');
    // Redirect to admin login
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-bold">Pawshu Admin</h1>
          <button 
            onClick={toggleDarkMode}
            className="p-1 rounded-full text-gray-300 hover:text-white focus:outline-none"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <SunIconComponent className="h-5 w-5" />
            ) : (
              <MoonIconComponent className="h-5 w-5" />
            )}
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-2 px-2">
            <li>
              <Link 
                to="/admin/dashboard" 
                className={`flex items-center px-4 py-3 text-gray-300 hover:bg-blue-600 rounded-lg ${isActive('/admin/dashboard')}`}
              >
                <HomeIconComponent className="h-5 w-5 mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link 
                to="/admin/products" 
                className={`flex items-center px-4 py-3 text-gray-300 hover:bg-blue-600 rounded-lg ${isActive('/admin/products')}`}
              >
                <ShoppingBagIconComponent className="h-5 w-5 mr-3" />
                Manage Products
              </Link>
            </li>
            <li>
              <Link 
                to="/admin/doctors" 
                className={`flex items-center px-4 py-3 text-gray-300 hover:bg-blue-600 rounded-lg ${isActive('/admin/doctors')}`}
              >
                <UserGroupIconComponent className="h-5 w-5 mr-3" />
                Manage Doctors
              </Link>
            </li>
            <li>
              <Link 
                to="/admin/charities" 
                className={`flex items-center px-4 py-3 text-gray-300 hover:bg-blue-600 rounded-lg ${isActive('/admin/charities')}`}
              >
                <HeartIconComponent className="h-5 w-5 mr-3" />
                Manage Charities
              </Link>
            </li>
            <li>
              <Link 
                to="/admin/stats" 
                className={`flex items-center px-4 py-3 text-gray-300 hover:bg-blue-600 rounded-lg ${isActive('/admin/stats')}`}
              >
                <ChartBarIconComponent className="h-5 w-5 mr-3" />
                Statistics
              </Link>
            </li>
            <li>
              <Link 
                to="/admin/users" 
                className={`flex items-center px-4 py-3 text-gray-300 hover:bg-blue-600 rounded-lg ${isActive('/admin/users')}`}
              >
                <UserIconComponent className="h-5 w-5 mr-3" />
                Manage Users
              </Link>
            </li>
            <li>
              <Link 
                to="/admin/settings" 
                className={`flex items-center px-4 py-3 text-gray-300 hover:bg-blue-600 rounded-lg ${isActive('/admin/settings')}`}
              >
                <CogIconComponent className="h-5 w-5 mr-3" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>
        
        <div className="p-4 border-t border-gray-700">
          <button 
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900">
        <div className="container mx-auto px-6 py-4">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout; 
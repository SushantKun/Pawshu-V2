// src/components/AdminNavbar.tsx
import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, ShoppingBagIcon, ChartBarIcon, UserIcon, CogIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const HomeIconComponent = HomeIcon as IconComponent;
const ShoppingBagIconComponent = ShoppingBagIcon as IconComponent;
const ChartBarIconComponent = ChartBarIcon as IconComponent;
const UserIconComponent = UserIcon as IconComponent;
const CogIconComponent = CogIcon as IconComponent;

const AdminNavbar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    return currentPath.includes(path) ? 'bg-blue-700' : '';
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">Pawshu Admin</h1>
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
          <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminNavbar;
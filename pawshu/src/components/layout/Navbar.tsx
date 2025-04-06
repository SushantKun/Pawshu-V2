import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCartIcon, UserIcon, SunIcon, MoonIcon, HeartIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import PawshuLogo from '../../assets/images/pawshu-logo.png';
import LogoWhite from '../../assets/images/pawshu-logo-white.png';
import MobileMenu from './MobileMenu';
import Notifications from '../Notifications';
import NotificationBell from '../NotificationBell';
import './Navbar.css';

// Type cast icon components to fix TypeScript errors
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const ShoppingCartIconComponent = ShoppingCartIcon as IconComponent;
const UserIconComponent = UserIcon as IconComponent;
const SunIconComponent = SunIcon as IconComponent;
const MoonIconComponent = MoonIcon as IconComponent;
const HeartIconComponent = HeartIcon as IconComponent;

// Import User interface from AuthContext
interface User {
  _id: string;
  email: string;
  role: string;
  createdAt: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface UserWithAvatar extends User {
  avatar?: {
    public_id?: string;
    url?: string;
    firstName?: string;
    lastName?: string;
    status?: string;
  };
}

const Navbar = () => {
  const location = useLocation();
  const { cartItems } = useCart();
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cartItemsCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const typedUser = user as UserWithAvatar | null;
  
  // Add debug logging
  useEffect(() => {
    console.log('Navbar user data:', user);
    console.log('Navbar avatar data:', typedUser?.avatar);
    if (user) {
      console.log('Notifications component should render (user logged in)');
    }
  }, [user, typedUser]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
  };

  const handleMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  let userDashboardLink = '/profile';
  if (user?.role === 'admin') {
    userDashboardLink = '/admin/dashboard';
  } else if (user?.role === 'doctor') {
    userDashboardLink = '/doctor/dashboard';
  }

  return (
    <header className="navbar">
      <nav className={`navbar-bg ${isScrolled ? 'py-2' : 'py-4'} ${darkMode ? 'bg-gray-900/80' : 'bg-white/80'}`}>
        <div className="navbar-content flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src={darkMode ? LogoWhite : PawshuLogo} 
              alt="Pawshu Logo" 
              className="navbar-logo" 
            />
            <span className="navbar-brand ml-2 font-bold text-blue-600 dark:text-blue-400">Pawshu</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className={`navbar-link transition-colors duration-200 ${
                isActive('/') 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/products" 
              className={`navbar-link transition-colors duration-200 ${
                isActive('/products') 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400'
              }`}
            >
              Shop
            </Link>
            <Link 
              to="/services" 
              className={`navbar-link transition-colors duration-200 ${
                isActive('/services') 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400'
              }`}
            >
              Services
            </Link>
            <Link 
              to="/about" 
              className={`navbar-link transition-colors duration-200 ${
                isActive('/about') 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400'
              }`}
            >
              About
            </Link>
            <Link 
              to="/contact" 
              className={`navbar-link transition-colors duration-200 ${
                isActive('/contact') 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400'
              }`}
            >
              Contact
            </Link>
          </div>

          {/* Right Icons */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button 
              onClick={toggleDarkMode} 
              className="p-2 rounded-full text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <SunIconComponent className="navbar-icon" style={{ width: '1.75rem', height: '1.75rem', display: 'block' }} />
              ) : (
                <MoonIconComponent className="navbar-icon" style={{ width: '1.75rem', height: '1.75rem', display: 'block' }} />
              )}
            </button>

            {/* Wishlist Icon */}
            {user && (
              <Link 
                to="/wishlist" 
                className="p-2 rounded-full text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label="Wishlist"
              >
                <HeartIconComponent className="navbar-icon" style={{ width: '1.75rem', height: '1.75rem', display: 'block' }} />
              </Link>
            )}

            {/* Notifications */}
            {user && (
              <Notifications />
            )}

            {/* Cart Icon */}
            <Link 
              to="/cart" 
              className="p-2 rounded-full text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 relative"
              aria-label="Shopping cart"
            >
              <ShoppingCartIconComponent className="navbar-icon" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {cartItemsCount}
                </span>
              )}
            </Link>

            {/* User Menu */}
            {user ? (
              <div className="relative">
                <button 
                  onClick={toggleDropdown}
                  className="p-2 rounded-full text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 flex items-center transition-colors duration-200"
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                >
                  {typedUser?.avatar ? (
                    <img 
                      src={typedUser.avatar.url} 
                      alt="User avatar" 
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <UserIconComponent className="h-5 w-5" />
                  )}
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 py-2 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {typedUser?.name || 
                         (typedUser?.firstName && typedUser?.lastName 
                           ? `${typedUser.firstName} ${typedUser.lastName}` 
                           : (typedUser?.avatar?.firstName && typedUser?.avatar?.lastName 
                               ? `${typedUser.avatar.firstName} ${typedUser.avatar.lastName}` 
                               : user.email))}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                    <Link 
                      to={userDashboardLink} 
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Dashboard
                    </Link>
                    <Link 
                      to="/profile" 
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      My Profile
                    </Link>
                    <Link 
                      to="/orders" 
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      My Orders
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                to="/login" 
                className="p-2 rounded-full text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label="Login"
              >
                <UserIconComponent className="h-5 w-5" />
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button 
              onClick={handleMenuToggle}
              className="p-2 rounded-full text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 md:hidden transition-colors duration-200"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </header>
  );
};

export default Navbar; 
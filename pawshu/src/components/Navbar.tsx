import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import ProfileDropdown from './ProfileDropdown';
import CartSlideOver from './CartSlideOver';
import { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCartIcon as ShoppingCartIconOutline, 
  HeartIcon as HeartIconOutline,
  SunIcon as SunIconOutline,
  MoonIcon as MoonIconOutline,
  BellIcon as BellIconOutline
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import type { ComponentType, SVGProps } from 'react';
import api from '../api/axios';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ShoppingCartIcon = ShoppingCartIconOutline as IconComponent;
const HeartIcon = HeartIconOutline as IconComponent;
const HeartSolidIcon = HeartIconSolid as IconComponent;
const SunIcon = SunIconOutline as IconComponent;
const MoonIcon = MoonIconOutline as IconComponent;
const BellIcon = BellIconOutline as IconComponent;

// Define the Appointment interface for notifications
interface Appointment {
  _id: string;
  doctor: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  date: string;
  timeSlot: string;
  petName: string;
  status: string;
  payment?: {
    status: string;
    method?: string;
    amount?: number;
  };
}

const Navbar = () => {
  const { user, loading } = useAuth();
  const { cartItems, isCartOpen, openCart, closeCart, updateQuantity, removeFromCart, wishlist } = useCart();
  const { darkMode, toggleDarkMode } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // State for notification dropdown
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<Appointment[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Debug log for user authentication state
  useEffect(() => {
    console.log('Auth State:', { 
      user: user ? { 
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName || user.avatar?.firstName,
        lastName: user.lastName || user.avatar?.lastName,
        isAdmin: user.isAdmin || user.avatar?.isAdmin,
        isDoctor: user.isDoctor || user.avatar?.isDoctor,
        status: user.status || user.avatar?.status
      } : null, 
      loading, 
      isAuthenticated: !!user 
    });
  }, [user, loading]);

  // Fetch notifications on mount
  useEffect(() => {
    if (user) {
      fetchPendingPayments();
    }
  }, [user]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchPendingPayments = async () => {
    try {
      setNotificationsLoading(true);
      const response = await api.get('/appointments/my-appointments');
      
      // Extract the appointments array safely
      let appointmentsData = [];
      if (response.data && response.data.appointments) {
        appointmentsData = response.data.appointments;
      } else if (Array.isArray(response.data)) {
        appointmentsData = response.data;
      }
      
      // Filter appointments that are confirmed but payment is pending
      const pendingPaymentAppointments = appointmentsData.filter(
        (appointment: Appointment) => 
          appointment.status === 'confirmed' && 
          (!appointment.payment || appointment.payment.status !== 'paid')
      );
      
      setPendingPayments(pendingPaymentAppointments);
      setNotificationsLoading(false);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      setNotificationsLoading(false);
    }
  };

  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistCount = wishlist.length;

  // Add scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      if (offset > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header className="fixed top-2 left-0 right-0 z-50">
      <div className="container mx-auto px-4">
        {/* Floating Navigation Bar */}
        <nav className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-full px-6 py-3 shadow-lg border border-white/20 dark:border-gray-700/20 flex items-center justify-between w-[80%] mx-auto">
          <Link to="/" className="flex-shrink-0 flex items-center">
            <img
              className="h-8 w-auto"
              src={darkMode ? "/PawshuLogo.png" : "/PawshuLogo.png"}
              alt="Pawshu Logo"
            />
          </Link>
          
          {/* Main Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/products" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-base font-medium transition-colors">
              Products
            </Link>
            <Link to="/booking" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-base font-medium transition-colors">
              Book Services
            </Link>
            <Link to="/lost-found" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-base font-medium transition-colors">
              Lost & Found
            </Link>
            <Link to="/donate" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-base font-medium transition-colors">
              Donate
            </Link>
          </div>
          
          {/* User Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            <button 
              onClick={toggleDarkMode}
              className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-full focus:outline-none transition-colors"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </button>
            
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-4">
                    <Link
                      to="/wishlist"
                      className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 relative transition-colors"
                    >
                      {wishlistCount > 0 ? (
                        <HeartSolidIcon className="h-6 w-6 text-red-500" />
                      ) : (
                        <HeartIcon className="h-6 w-6" />
                      )}
                      {wishlistCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-sm rounded-full h-5 w-5 flex items-center justify-center">
                          {wishlistCount}
                        </span>
                      )}
                    </Link>
                    
                    {/* Notification Bell Icon with Dropdown */}
                    <div className="relative" ref={notificationRef}>
                      <button
                        onClick={() => {
                          setShowNotificationDropdown(!showNotificationDropdown);
                        }}
                        className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 relative transition-colors"
                        aria-label="Notifications"
                      >
                        <BellIcon className="h-6 w-6" style={{ display: 'block', minWidth: '1.5rem', minHeight: '1.5rem' }} />
                        {pendingPayments.length > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {pendingPayments.length}
                          </span>
                        )}
                      </button>

                      {/* Notification Dropdown */}
                      {showNotificationDropdown && (
                        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 animate-fadeIn">
                          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Notifications</h3>
                          </div>
                          
                          <div className="max-h-80 overflow-y-auto">
                            {notificationsLoading ? (
                              <div className="p-4 flex justify-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                              </div>
                            ) : pendingPayments.length > 0 ? (
                              <div>
                                {pendingPayments.map((appointment) => (
                                  <div key={appointment._id} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                    <p className="text-sm text-gray-800 dark:text-white font-medium">
                                      Payment Required
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Appointment with Dr. {appointment.doctor.firstName} {appointment.doctor.lastName} 
                                      on {new Date(appointment.date).toLocaleDateString()} at {appointment.timeSlot} 
                                      for {appointment.petName}.
                                    </p>
                                    <div className="mt-2">
                                      <Link 
                                        to="/profile" 
                                        className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                                        onClick={() => setShowNotificationDropdown(false)}
                                      >
                                        Make Payment →
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                No new notifications
                              </div>
                            )}
                          </div>
                          
                          <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
                            <Link 
                              to="/notifications" 
                              className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                              onClick={() => setShowNotificationDropdown(false)}
                            >
                              View All Notifications
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={openCart}
                      className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 relative transition-colors"
                      aria-label="Shopping cart"
                    >
                      <ShoppingCartIcon className="h-6 w-6" />
                      {cartItemsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-sm rounded-full h-5 w-5 flex items-center justify-center">
                          {cartItemsCount}
                        </span>
                      )}
                    </button>
                    <ProfileDropdown />
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Link
                      to="/login"
                      className="px-4 py-2 rounded-full text-white bg-blue-500 hover:bg-blue-600 transition-colors text-base shadow-sm"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="px-4 py-2 rounded-full text-blue-500 dark:text-blue-400 border border-blue-500 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800/50 transition-colors text-base shadow-sm"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden py-4 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl mt-2 mx-4 rounded-lg shadow-lg border border-white/20 dark:border-gray-700/20">
          <div className="flex flex-col space-y-2">
            <Link to="/products" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors">
              Products
            </Link>
            <Link to="/booking" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors">
              Book Services
            </Link>
            <Link to="/lost-found" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors">
              Lost & Found
            </Link>
            <Link to="/donate" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors">
              Donate
            </Link>
            
            {/* Dark Mode Toggle in Mobile Menu */}
            <button 
              onClick={toggleDarkMode}
              className="flex items-center text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors"
            >
              {darkMode ? (
                <>
                  <SunIcon className="h-5 w-5 mr-2" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <MoonIcon className="h-5 w-5 mr-2" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
            
            {/* Add Notification and Chat links for mobile when user is logged in */}
            {user && (
              <>
                <button 
                  onClick={() => {
                    setShowNotificationDropdown(!showNotificationDropdown);
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-between text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors w-full"
                >
                  <div className="flex items-center">
                    <BellIcon className="h-5 w-5 mr-2" />
                    <span>Notifications</span>
                  </div>
                  {pendingPayments.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {pendingPayments.length}
                    </span>
                  )}
                </button>
              </>
            )}
            
            {!user && !loading && (
              <div className="flex flex-col space-y-2 pt-2 border-t border-white/20 dark:border-gray-700/20">
                <Link to="/login" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors">
                  Login
                </Link>
                <Link to="/register" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cart Slide Over */}
      <CartSlideOver 
        isOpen={isCartOpen}
        setIsOpen={closeCart}
        cartItems={cartItems}
        updateQuantity={updateQuantity}
        removeItem={removeFromCart}
      />
    </header>
  );
};

export default Navbar; 
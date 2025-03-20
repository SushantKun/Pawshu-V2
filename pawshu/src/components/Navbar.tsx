import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useChat } from '../context/ChatContext';  // New context
import ProfileDropdown from './ProfileDropdown';
import CartSlideOver from './CartSlideOver';
import { useState, useEffect } from 'react';
import { 
  ShoppingCartIcon as ShoppingCartIconOutline, 
  HeartIcon as HeartIconOutline,
  SunIcon as SunIconOutline,
  MoonIcon as MoonIconOutline
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import type { ComponentType, SVGProps } from 'react';
import ChatWindow from './chat/ChatWindow';  // New component

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ShoppingCartIcon = ShoppingCartIconOutline as IconComponent;
const HeartIcon = HeartIconOutline as IconComponent;
const HeartSolidIcon = HeartIconSolid as IconComponent;
const SunIcon = SunIconOutline as IconComponent;
const MoonIcon = MoonIconOutline as IconComponent;

const Navbar = () => {
  const { user, loading } = useAuth();
  const { cartItems, isCartOpen, openCart, closeCart, updateQuantity, removeFromCart, wishlist } = useCart();
  const { darkMode, toggleDarkMode } = useTheme();
  const { unreadChats, setIsChatOpen, isChatOpen } = useChat();  // Track unread chats
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  const toggleChatWindow = () => {
    setIsChatOpen(!isChatOpen);
  };

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
            <Link to="/chat" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-base font-medium transition-colors">
              Chat
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
                    <button
                      onClick={toggleChatWindow}
                      className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 relative transition-colors"
                      aria-label="Chat"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {unreadChats > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-sm rounded-full h-5 w-5 flex items-center justify-center">
                          {unreadChats}
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
            <Link to="/chat" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors">
              Chat
            </Link>
            <Link to="/contact" className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 transition-colors">
              Contact
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
            {user && (
              <div className="flex justify-between items-center px-4 py-2 border-t border-white/20 dark:border-gray-700/20 mt-2">
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
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={openCart}
                  className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 relative transition-colors"
                >
                  <ShoppingCartIcon className="h-6 w-6" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartItemsCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={toggleChatWindow}
                  className="text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 relative transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {unreadChats > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadChats}
                    </span>
                  )}
                </button>
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

      {/* Chat Window */}
      {isChatOpen && (
        <div className="absolute top-full right-0 mt-2">
          <ChatWindow onClose={() => setIsChatOpen(false)} />
        </div>
      )}
    </header>
  );
};

export default Navbar; 
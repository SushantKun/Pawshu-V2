import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ProfileDropdown from './ProfileDropdown';
import CartSlideOver from './CartSlideOver';
import { useState } from 'react';
import { ShoppingCartIcon as ShoppingCartIconOutline, HeartIcon as HeartIconOutline } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ShoppingCartIcon = ShoppingCartIconOutline as IconComponent;
const HeartIcon = HeartIconOutline as IconComponent;
const HeartSolidIcon = HeartIconSolid as IconComponent;

const Navbar = () => {
  const { user, loading } = useAuth();
  const { cartItems, isCartOpen, openCart, closeCart, updateQuantity, removeFromCart, wishlist } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistCount = wishlist.length;

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-blue-600">
              Pawshu
            </Link>
            
            {/* Main Navigation */}
            <div className="hidden md:flex items-center ml-10 space-x-8">
              <Link to="/products" className="text-gray-600 hover:text-blue-600">
                Products
              </Link>
              <Link to="/booking" className="text-gray-600 hover:text-blue-600">
                Book Services
              </Link>
              <Link to="/lost-found" className="text-gray-600 hover:text-blue-600">
                Lost & Found
              </Link>
              <Link to="/donation" className="text-gray-600 hover:text-blue-600">
                Donate
              </Link>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-4">
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-4">
                    <Link
                      to="/wishlist"
                      className="text-gray-600 hover:text-blue-600 relative"
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
                      className="text-gray-600 hover:text-blue-600 relative"
                    >
                      <ShoppingCartIcon className="h-6 w-6" />
                      {cartItemsCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {cartItemsCount}
                        </span>
                      )}
                    </button>
                    <ProfileDropdown />
                  </div>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="px-4 py-2 rounded-md text-white bg-blue-500 hover:bg-blue-600"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="px-4 py-2 rounded-md text-blue-500 border border-blue-500 hover:bg-blue-50"
                    >
                      Register
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-4">
            {user && (
              <>
                <Link
                  to="/wishlist"
                  className="text-gray-600 hover:text-blue-600 relative"
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
                  className="text-gray-600 hover:text-blue-600 relative"
                >
                  <ShoppingCartIcon className="h-6 w-6" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartItemsCount}
                    </span>
                  )}
                </button>
              </>
            )}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-600 hover:text-blue-600 focus:outline-none"
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
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4">
            <div className="flex flex-col space-y-2">
              <Link to="/products" className="text-gray-600 hover:text-blue-600 px-4 py-2">
                Products
              </Link>
              <Link to="/booking" className="text-gray-600 hover:text-blue-600 px-4 py-2">
                Book Services
              </Link>
              <Link to="/lost-found" className="text-gray-600 hover:text-blue-600 px-4 py-2">
                Lost & Found
              </Link>
              <Link to="/donation" className="text-gray-600 hover:text-blue-600 px-4 py-2">
                Donate
              </Link>
              {!user && !loading && (
                <>
                  <Link to="/login" className="text-gray-600 hover:text-blue-600 px-4 py-2">
                    Login
                  </Link>
                  <Link to="/register" className="text-gray-600 hover:text-blue-600 px-4 py-2">
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cart Slide Over */}
      <CartSlideOver
        isOpen={isCartOpen}
        setIsOpen={closeCart}
        cartItems={cartItems}
        updateQuantity={updateQuantity}
        removeItem={removeFromCart}
      />
    </nav>
  );
};

export default Navbar; 
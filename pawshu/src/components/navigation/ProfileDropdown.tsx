import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Debug logging for profile dropdown
  useEffect(() => {
    if (user) {
      console.log('ProfileDropdown user:', user);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  // Get properties from top level or avatar object, with priority to top level
  const firstName = user.firstName || user.avatar?.firstName || '';
  const lastName = user.lastName || user.avatar?.lastName || '';
  const avatarUrl = user.avatar?.url;

  // Get the first letter of the user's first name or use a fallback
  const userInitial = firstName.charAt(0) || (user.email ? user.email.charAt(0) : 'U');

  // Get display name
  const displayName = firstName ? 
                     (lastName ? `${firstName} ${lastName}` : firstName) : 
                     user.email;

  // Format role for display (capitalize first letter)
  const roleDisplay = user.role ? 
                     user.role.charAt(0).toUpperCase() + user.role.slice(1) : 
                     'User';

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 focus:outline-none"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white dark:border-gray-700">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white">
              {userInitial.toUpperCase()}
            </div>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50">
          <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b dark:border-gray-700">
            <div className="font-medium">{displayName}</div>
            <div className="text-gray-500 dark:text-gray-400">{user.email}</div>
            <div className="text-xs mt-1 inline-block bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded px-2 py-0.5">
              {roleDisplay}
            </div>
          </div>
          
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/profile');
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Your Profile
          </button>
          
          <button
            onClick={() => {
              setIsOpen(false);
              navigate('/settings');
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Settings
          </button>
          
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown; 
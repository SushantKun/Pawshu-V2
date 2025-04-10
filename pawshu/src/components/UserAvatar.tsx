import React from 'react';

interface UserAvatarProps {
  url?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  email?: string;
  bgColor?: string;
  id?: string;
}

/**
 * A reusable user avatar component that displays either an image or initials
 */
const UserAvatar: React.FC<UserAvatarProps> = ({
  url,
  name,
  size = 'md',
  email,
  bgColor = 'bg-blue-500',
  id
}) => {
  // Calculate sizing based on the size prop
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };
  
  // Get initial letters (up to 2) from name or email
  const getInitials = () => {
    if (name && name.trim() !== '') {
      // Split name by spaces and get first letter of each part
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
      } else {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
      }
    } else if (email) {
      return email.charAt(0).toUpperCase();
    }
    return 'U'; // Default
  };

  // Return image if URL is provided, otherwise return initials in a colored circle
  return url ? (
    <img 
      src={url} 
      alt={name || 'User'}
      className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200 dark:border-gray-700`}
      loading="lazy" 
    />
  ) : (
    <div 
      className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-medium`}
      title={name || email || id || 'User'}
    >
      {getInitials()}
    </div>
  );
};

export default UserAvatar; 
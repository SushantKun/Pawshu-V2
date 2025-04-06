import React from 'react';
import { BellIcon } from '@heroicons/react/24/solid'; // Using solid icon for better visibility
import type { ComponentType, SVGProps } from 'react';

// Type cast icon components to fix TypeScript errors
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const BellIconComponent = BellIcon as IconComponent;

const NotificationBell: React.FC = () => {
  return (
    <div className="relative p-2 rounded-full text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200">
      <BellIconComponent
        style={{
          width: '28px',
          height: '28px',
          color: '#ef4444', // Red color to make it stand out
          display: 'block',
        }}
      />
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
        1
      </span>
    </div>
  );
};

export default NotificationBell; 
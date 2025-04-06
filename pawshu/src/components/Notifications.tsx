import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/solid';
import type { ComponentType, SVGProps } from 'react';
import api from '../api/axios';
import './layout/Navbar.css'; // Import the Navbar.css file

// Type cast icon components to fix TypeScript errors
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const BellIconComponent = BellIcon as IconComponent;

// Define the Appointment interface 
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
  createdAt: string;
  updatedAt?: string;
  payment?: {
    status: string;
    method?: string;
    amount?: number;
  };
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'payment' | 'status' | 'system';
  date: string;
  read: boolean;
  link: string;
  data?: any;
}

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  useEffect(() => {
    // Initial fetch
    fetchAppointments();

    // Store the current time as our reference point
    setLastCheckTime(new Date());

    // Set up interval to check for new notifications every minute
    const interval = setInterval(() => {
      fetchAppointments();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments/my-appointments');
      
      // Extract the appointments array safely
      let appointmentsData = [];
      if (response.data && response.data.appointments) {
        appointmentsData = response.data.appointments;
      } else if (Array.isArray(response.data)) {
        appointmentsData = response.data;
      }
      
      console.log('Fetched appointments for notifications:', appointmentsData);
      
      // Create notifications list
      const newNotifications: Notification[] = [];
      
      // Process appointments for notifications
      appointmentsData.forEach((appointment: Appointment) => {
        // Check for pending payments on confirmed appointments
        if (appointment.status === 'confirmed' && 
            (!appointment.payment || appointment.payment.status !== 'paid')) {
          newNotifications.push({
            id: `payment-${appointment._id}`,
            title: 'Payment Required',
            message: `Appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} on ${new Date(appointment.date).toLocaleDateString()} requires payment.`,
            type: 'payment',
            date: new Date().toISOString(),
            read: false,
            link: '/profile',
            data: appointment
          });
        }
        
        // Check for recently confirmed appointments (doctor accepted)
        if (appointment.status === 'confirmed' && appointment.updatedAt) {
          // If we have a lastCheckTime, only show notifications for appointments that were updated after that
          if (!lastCheckTime || new Date(appointment.updatedAt) > lastCheckTime) {
            newNotifications.push({
              id: `status-${appointment._id}`,
              title: 'Appointment Confirmed',
              message: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} has confirmed your appointment for ${new Date(appointment.date).toLocaleDateString()} at ${appointment.timeSlot}.`,
              type: 'status',
              date: appointment.updatedAt,
              read: false,
              link: '/profile',
              data: appointment
            });
          }
        }
        
        // Check for recently completed appointments
        if (appointment.status === 'completed' && appointment.updatedAt) {
          // If we have a lastCheckTime, only show notifications for appointments that were updated after that
          if (!lastCheckTime || new Date(appointment.updatedAt) > lastCheckTime) {
            newNotifications.push({
              id: `status-${appointment._id}`,
              title: 'Appointment Completed',
              message: `Your appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} on ${new Date(appointment.date).toLocaleDateString()} has been marked as completed.`,
              type: 'status',
              date: appointment.updatedAt,
              read: false,
              link: '/profile',
              data: appointment
            });
          }
        }
      });
      
      // Sort notifications by date (newest first)
      newNotifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log('Processed notifications:', newNotifications);
      
      // Check if we have new notifications compared to current state
      if (newNotifications.length > notifications.length) {
        setHasNewNotifications(true);
      }
      
      // Update the state with new notifications
      setNotifications(newNotifications);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching appointments for notifications:', error);
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown) {
      setHasNewNotifications(false); // Reset the notification indicator when opening dropdown
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="p-2 rounded-full text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 relative"
        aria-label="Notifications"
      >
        <BellIconComponent 
          style={{ 
            width: '28px', 
            height: '28px', 
            color: '#3b82f6', // Blue color to make it stand out
            display: 'block',
            minWidth: '28px',
            minHeight: '28px'
          }} 
        />
        {hasNewNotifications && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full notification-badge">
            {notifications.length}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 animate-fadeIn">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Notifications</h3>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : notifications.length > 0 ? (
              <div>
                {notifications.map((notification) => (
                  <div key={notification.id} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-800 dark:text-white font-medium">
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {notification.message}
                    </p>
                    <div className="mt-2 flex justify-between items-center">
                      <Link 
                        to={notification.link} 
                        className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {notification.type === 'payment' ? 'Make Payment →' : 'View Details →'}
                      </Link>
                      <span className="text-xs text-gray-400">
                        {new Date(notification.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
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
          
          {notifications.length > 0 && (
            <div className="p-2 text-center border-t border-gray-200 dark:border-gray-700">
              <Link 
                to="/notifications" 
                className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={() => setShowDropdown(false)}
              >
                View All Notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications; 
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
  payment?: {
    status: string;
    method?: string;
    amount?: number;
  };
}

const Notifications: React.FC = () => {
  const [pendingPayments, setPendingPayments] = useState<Appointment[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  useEffect(() => {
    fetchPendingPayments();

    // Set up interval to check for new notifications every minute
    const interval = setInterval(() => {
      fetchPendingPayments();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments/my-appointments');
      
      // The API returns { appointments: [...], userType: '...' } or directly an array
      // Extract the appointments array safely
      let appointmentsData = [];
      if (response.data && response.data.appointments) {
        // API response has the expected structure with appointments property
        appointmentsData = response.data.appointments;
      } else if (Array.isArray(response.data)) {
        // API directly returns an array
        appointmentsData = response.data;
      }
      
      console.log('Fetched appointments for notifications:', appointmentsData);
      
      // Filter appointments that are confirmed but payment is pending
      const pendingPaymentAppointments = appointmentsData.filter(
        (appointment: Appointment) => 
          appointment.status === 'confirmed' && 
          (!appointment.payment || appointment.payment.status !== 'paid')
      );
      
      console.log('Pending payment appointments:', pendingPaymentAppointments);
      
      // Check if we have new notifications compared to current state
      if (pendingPaymentAppointments.length > pendingPayments.length) {
        setHasNewNotifications(true);
      }
      
      setPendingPayments(pendingPaymentAppointments);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
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
            {pendingPayments.length}
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
        </div>
      )}
    </div>
  );
};

export default Notifications; 
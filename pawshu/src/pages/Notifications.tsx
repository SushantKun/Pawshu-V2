import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

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

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/appointments/my-appointments');
      
      // Extract the appointments array safely
      let appointmentsData = [];
      if (response.data && response.data.appointments) {
        appointmentsData = response.data.appointments;
      } else if (Array.isArray(response.data)) {
        appointmentsData = response.data;
      }
      
      console.log('Fetched appointments for notifications page:', appointmentsData);
      
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
            message: `Appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.timeSlot} requires payment.`,
            type: 'payment',
            date: new Date().toISOString(),
            read: false,
            link: '/profile',
            data: appointment
          });
        }
        
        // Add notifications for confirmed appointments
        if (appointment.status === 'confirmed') {
          newNotifications.push({
            id: `status-confirmed-${appointment._id}`,
            title: 'Appointment Confirmed',
            message: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} has confirmed your appointment for ${new Date(appointment.date).toLocaleDateString()} at ${appointment.timeSlot}.`,
            type: 'status',
            date: appointment.updatedAt || appointment.createdAt,
            read: false,
            link: '/profile',
            data: appointment
          });
        }
        
        // Add notifications for completed appointments
        if (appointment.status === 'completed') {
          newNotifications.push({
            id: `status-completed-${appointment._id}`,
            title: 'Appointment Completed',
            message: `Your appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} on ${new Date(appointment.date).toLocaleDateString()} has been marked as completed.`,
            type: 'status',
            date: appointment.updatedAt || appointment.createdAt,
            read: false,
            link: '/profile',
            data: appointment
          });
        }
        
        // Add notifications for cancelled appointments
        if (appointment.status === 'cancelled') {
          newNotifications.push({
            id: `status-cancelled-${appointment._id}`,
            title: 'Appointment Cancelled',
            message: `Your appointment with Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} on ${new Date(appointment.date).toLocaleDateString()} has been cancelled.`,
            type: 'status',
            date: appointment.updatedAt || appointment.createdAt,
            read: false,
            link: '/profile',
            data: appointment
          });
        }
      });
      
      // Sort notifications by date (newest first)
      newNotifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Update the state with new notifications
      setNotifications(newNotifications);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching appointments for notifications:', error);
      setError('Failed to load notifications. Please try again later.');
      setLoading(false);
    }
  };

  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Notifications</h1>
        
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        ) : notifications.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            {notifications.map((notification, index) => (
              <div 
                key={notification.id} 
                className={`p-4 ${index !== notifications.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 rounded-full w-10 h-10 flex items-center justify-center ${
                    notification.type === 'payment' 
                      ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300' 
                      : notification.type === 'status' && notification.title.includes('Confirmed')
                        ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                        : notification.type === 'status' && notification.title.includes('Completed')
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                          : notification.type === 'status' && notification.title.includes('Cancelled')
                            ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {notification.type === 'payment' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    )}
                    {notification.type === 'status' && notification.title.includes('Confirmed') && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {notification.type === 'status' && notification.title.includes('Completed') && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    )}
                    {notification.type === 'status' && notification.title.includes('Cancelled') && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-semibold text-gray-800 dark:text-white">
                        {notification.title}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatNotificationDate(notification.date)}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      {notification.message}
                    </p>
                    <div className="mt-2">
                      <Link 
                        to={notification.link} 
                        className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {notification.type === 'payment' ? 'Make Payment →' : 'View Details →'}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Notifications
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              You don't have any notifications at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage; 
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';

interface Appointment {
  _id: string;
  user: {
    name: string;
    email: string;
  };
  date: string;
  timeSlot: string;
  petName: string;
  petType: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

const DoctorDashboard = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if doctor is logged in
    const token = localStorage.getItem('doctorToken');
    const storedDoctorInfo = localStorage.getItem('doctorInfo');
    
    if (!token || !storedDoctorInfo) {
      navigate('/doctor/login');
      return;
    }
    
    setDoctorInfo(JSON.parse(storedDoctorInfo));
    
    // Fetch appointments
    fetchAppointments();
  }, [navigate]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      
      const response = await api.get('/appointments/doctor', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('doctorToken')}`
        }
      });
      
      console.log('Appointments response:', response.data);
      
      setAppointments(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      setError(err.response?.data?.message || 'Failed to fetch appointments');
      
      if (err.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        // Unauthorized, redirect to login
        localStorage.removeItem('doctorToken');
        localStorage.removeItem('doctorInfo');
        navigate('/doctor/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (id: string, status: string, notes?: string) => {
    try {
      await api.put(`/appointments/${id}/status`, 
        { status, notes },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('doctorToken')}`
          }
        }
      );
      
      // Success toast
      toast.success(`Appointment ${status} successfully`);
      
      // Refresh appointments
      fetchAppointments();
    } catch (err: any) {
      console.error('Error updating appointment:', err);
      toast.error(err.response?.data?.message || 'Failed to update appointment');
    }
  };

  // Group appointments by date
  const groupedAppointments: Record<string, Appointment[]> = {};
  appointments.forEach(appointment => {
    const date = new Date(appointment.date).toLocaleDateString();
    if (!groupedAppointments[date]) {
      groupedAppointments[date] = [];
    }
    groupedAppointments[date].push(appointment);
  });

  // Sort dates
  const sortedDates = Object.keys(groupedAppointments).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  return (
    <div className="flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Doctor Dashboard</h1>
        
        {doctorInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Welcome, Dr. {doctorInfo.firstName} {doctorInfo.lastName}</h2>
            <p className="text-gray-600 dark:text-gray-300">{doctorInfo.specialization}</p>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Appointments Overview</h2>
          <button 
            onClick={() => navigate('/doctor/appointments')} 
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
            Manage All Appointments
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Appointments Found</h3>
            <p className="text-gray-500 dark:text-gray-400">You don't have any appointments scheduled at the moment.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="bg-blue-50 dark:bg-blue-900 px-4 py-2 border-b border-blue-100 dark:border-blue-800">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200">{date}</h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {groupedAppointments[date].map(appointment => (
                    <div key={appointment._id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{appointment.petName}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Owner: {appointment.user.name} • {new Date(appointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Reason: {appointment.reason}
                          </p>
                          {appointment.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                              Notes: {appointment.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            appointment.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                            appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 
                            appointment.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                            appointment.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </div>
                      </div>
                      
                      {appointment.status === 'pending' && (
                        <div className="mt-3 flex space-x-2">
                          <button 
                            onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => updateAppointmentStatus(appointment._id, 'cancelled')}
                            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      
                      {appointment.status === 'confirmed' && (
                        <div className="mt-3">
                          <button 
                            onClick={() => updateAppointmentStatus(appointment._id, 'completed', 'Appointment completed successfully.')}
                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                          >
                            Mark as Completed
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard; 
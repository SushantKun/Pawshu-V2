import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

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
      const token = localStorage.getItem('doctorToken');
      
      const response = await axios.get(`${API_URL}/appointments/doctor`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setAppointments(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      setError(err.response?.data?.message || 'Failed to fetch appointments');
      
      if (err.response?.status === 401) {
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
      const token = localStorage.getItem('doctorToken');
      
      await axios.put(`${API_URL}/appointments/${id}`, 
        { status, notes },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Refresh appointments
      fetchAppointments();
    } catch (err: any) {
      console.error('Error updating appointment:', err);
      alert(err.response?.data?.message || 'Failed to update appointment');
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
        <h1 className="text-2xl font-semibold mb-6">Doctor Dashboard</h1>
        
        {doctorInfo && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-lg font-medium">Welcome, Dr. {doctorInfo.firstName} {doctorInfo.lastName}</h2>
            <p className="text-gray-600">{doctorInfo.specialization}</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold mb-4">Your Appointments</h2>
            
            {appointments.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-500">No appointments scheduled.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedDates.map(date => (
                  <div key={date} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="bg-blue-500 text-white px-4 py-2">
                      <h3 className="font-semibold">{date}</h3>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {groupedAppointments[date].map(appointment => (
                        <div key={appointment._id} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{appointment.timeSlot}</h4>
                              <p className="text-gray-600">{appointment.user.name} ({appointment.user.email})</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${
                              appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              appointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-2">
                            <div>
                              <p className="text-sm text-gray-500">Pet Name</p>
                              <p>{appointment.petName}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Pet Type</p>
                              <p>{appointment.petType}</p>
                            </div>
                          </div>
                          
                          <div className="mb-2">
                            <p className="text-sm text-gray-500">Reason</p>
                            <p>{appointment.reason}</p>
                          </div>
                          
                          {appointment.notes && (
                            <div className="mb-2">
                              <p className="text-sm text-gray-500">Notes</p>
                              <p>{appointment.notes}</p>
                            </div>
                          )}
                          
                          {appointment.status === 'pending' && (
                            <div className="flex space-x-2 mt-4">
                              <button
                                onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')}
                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => {
                                  const notes = prompt('Enter reason for cancellation:');
                                  if (notes) {
                                    updateAppointmentStatus(appointment._id, 'cancelled', notes);
                                  }
                                }}
                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          
                          {appointment.status === 'confirmed' && (
                            <div className="flex space-x-2 mt-4">
                              <button
                                onClick={() => {
                                  const notes = prompt('Enter treatment notes:');
                                  if (notes) {
                                    updateAppointmentStatus(appointment._id, 'completed', notes);
                                  }
                                }}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                              >
                                Complete
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
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard; 
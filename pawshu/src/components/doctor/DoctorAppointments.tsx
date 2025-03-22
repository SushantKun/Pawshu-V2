import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';

interface Appointment {
  _id: string;
  doctor: {
    _id: string;
    firstName: string;
    lastName: string;
    specialization: string;
  };
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  date: string;
  timeSlot: string;
  petName: string;
  petType: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
}

interface GroupedAppointments {
  [date: string]: Appointment[];
}

const DoctorAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if doctor is logged in
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      navigate('/doctor/login');
      return;
    }
    
    // Fetch appointments
    fetchAppointments();
  }, [navigate]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      
      // Use the correct API endpoint
      const response = await api.get('/appointments/doctor', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('doctorToken')}`
        }
      });
      
      console.log('Doctor appointments fetched:', response.data.length);
      
      setAppointments(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      const errorMsg = err.response?.data?.message || 'Failed to fetch appointments';
      setError(errorMsg);
      
      if (err.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        // Unauthorized, redirect to login
        localStorage.removeItem('doctorToken');
        localStorage.removeItem('doctorInfo');
        navigate('/doctor/login');
      } else {
        toast.warning(`${errorMsg} - Using dummy data for now`);
        // Use dummy data as fallback
        const dummyAppointments: Appointment[] = [
          {
            _id: "appointment1",
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            timeSlot: "10:00 AM",
            status: "pending",
            petName: "Max",
            petType: "Dog",
            reason: "Annual checkup",
            notes: "First time visit",
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            doctor: {
              _id: "doctor1",
              firstName: "John",
              lastName: "Smith",
              specialization: "General"
            },
            user: {
              _id: "user1",
              firstName: "Alice",
              lastName: "Johnson",
              email: "alice@example.com"
            }
          },
          {
            _id: "appointment2",
            date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            timeSlot: "2:30 PM",
            status: "confirmed",
            petName: "Bella",
            petType: "Cat",
            reason: "Vaccination",
            notes: "Follow-up visit",
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            doctor: {
              _id: "doctor1",
              firstName: "John",
              lastName: "Smith",
              specialization: "General"
            },
            user: {
              _id: "user2",
              firstName: "Bob",
              lastName: "Williams",
              email: "bob@example.com"
            }
          },
          {
            _id: "appointment3",
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            timeSlot: "11:15 AM",
            status: "completed",
            petName: "Charlie",
            petType: "Dog",
            reason: "Skin condition",
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            doctor: {
              _id: "doctor1",
              firstName: "John",
              lastName: "Smith",
              specialization: "General"
            },
            user: {
              _id: "user3",
              firstName: "Carol",
              lastName: "Brown",
              email: "carol@example.com"
            }
          }
        ];
        setAppointments(dummyAppointments);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      setLoading(true);
      
      await api.put(
        `/appointments/${appointmentId}/status`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('doctorToken')}`
          }
        }
      );
      
      // Show success message
      toast.success(`Appointment status updated to ${status}`);
      
      // Update local state
      setAppointments(prevAppointments => 
        prevAppointments.map(appointment => 
          appointment._id === appointmentId 
            ? { ...appointment, status: status as 'pending' | 'confirmed' | 'completed' | 'cancelled' } 
            : appointment
        )
      );
      
      setError('');
    } catch (err: any) {
      console.error('Error updating appointment:', err);
      toast.error(err.response?.data?.message || 'Failed to update appointment');
      setError(err.response?.data?.message || 'Failed to update appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    try {
      setLoading(true);
      
      await api.put(
        `/appointments/${selectedAppointment._id}/status`,
        { 
          status: selectedAppointment.status,
          notes 
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('doctorToken')}`
          }
        }
      );
      
      // Show success message
      toast.success('Notes added successfully');
      
      // Update local state
      setAppointments(prevAppointments => 
        prevAppointments.map(appointment => 
          appointment._id === selectedAppointment._id 
            ? { ...appointment, notes } 
            : appointment
        )
      );
      
      setShowNotesModal(false);
      setNotes('');
      setSelectedAppointment(null);
      setError('');
    } catch (err: any) {
      console.error('Error adding notes:', err);
      toast.error(err.response?.data?.message || 'Failed to add notes');
      setError(err.response?.data?.message || 'Failed to add notes');
    } finally {
      setLoading(false);
    }
  };

  // Filter appointments based on status and search term
  const filteredAppointments = appointments.filter(appointment => {
    const matchesStatus = filterStatus === 'all' || appointment.status === filterStatus;
    
    // Create a safe user name for searching
    const userName = appointment.user 
      ? `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}`.toLowerCase()
      : '';
    
    const matchesSearch = 
      appointment.petName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userName.includes(searchTerm.toLowerCase()) ||
      appointment.reason.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  // Group appointments by date
  const groupAppointmentsByDate = (appointments: Appointment[]): GroupedAppointments => {
    return appointments.reduce((groups: GroupedAppointments, appointment) => {
      const date = new Date(appointment.date).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(appointment);
      return groups;
    }, {});
  };

  const groupedAppointments = groupAppointmentsByDate(filteredAppointments);
  
  // Sort dates in ascending order
  const sortedDates = Object.keys(groupedAppointments).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Appointments</h1>
        
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
            <div className="mb-4 md:mb-0">
              <label htmlFor="filterStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter by Status
              </label>
              <select
                id="filterStatus"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full md:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Appointments</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search Appointments
              </label>
              <input
                type="text"
                id="searchTerm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by pet name, owner, or reason..."
                className="w-full md:w-80 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>
          
          <button
            onClick={fetchAppointments}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">No appointments found</p>
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                {formatDate(date)}
              </h2>
              <div className="space-y-4">
                {groupedAppointments[date].map(appointment => (
                  <div key={appointment._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          {appointment.petName} ({appointment.petType})
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-1">
                          Owner: {appointment.user?.firstName || 'Unknown'} {appointment.user?.lastName || ''}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 mb-1">
                          Time: {appointment.timeSlot}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300">
                          Reason: {appointment.reason}
                        </p>
                        {appointment.notes && (
                          <p className="text-gray-600 dark:text-gray-300 mt-2">
                            Notes: {appointment.notes}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 md:mt-0 flex flex-col space-y-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${getStatusBadgeColor(appointment.status)}`}>
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </span>
                        <div className="flex flex-col space-y-2">
                          {appointment.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-600"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => updateAppointmentStatus(appointment._id, 'cancelled')}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:hover:bg-red-600"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {appointment.status === 'confirmed' && (
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, 'completed')}
                              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:hover:bg-green-600"
                            >
                              Mark as Completed
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setNotes(appointment.notes || '');
                              setShowNotesModal(true);
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                          >
                            {appointment.notes ? 'Edit Notes' : 'Add Notes'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showNotesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {selectedAppointment?.notes ? 'Edit Notes' : 'Add Notes'}
            </h2>
            <form onSubmit={handleAddNotes}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-32 resize-none"
                placeholder="Enter appointment notes..."
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNotesModal(false);
                    setSelectedAppointment(null);
                    setNotes('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-600"
                >
                  Save Notes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorAppointments; 
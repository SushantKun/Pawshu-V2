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
  payment?: {
    status: 'pending' | 'paid' | 'refunded';
    amount: number;
    transactionId?: string;
    method?: 'cash' | 'card' | 'khalti' | 'esewa';
    paidAt?: string;
  };
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'khalti' | 'esewa'>('cash');
  const [transactionId, setTransactionId] = useState('');
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

  // Fix the updatePaymentStatus function
  const updatePaymentStatus = async (appointmentId: string, paymentData: { 
    status: 'pending' | 'paid' | 'refunded'; 
    method?: 'cash' | 'card' | 'khalti' | 'esewa';
    transactionId?: string;
  }) => {
    try {
      setLoading(true);
      
      await api.put(
        `/appointments/${appointmentId}/payment`,
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('doctorToken')}`
          }
        }
      );
      
      // Show success message
      toast.success(`Payment status updated to ${paymentData.status}`);
      
      // Update local state with proper type handling
      setAppointments(prevAppointments => 
        prevAppointments.map(appointment => {
          if (appointment._id === appointmentId) {
            // Make sure we maintain the existing payment fields while updating with new data
            const updatedPayment = {
              status: paymentData.status,
              amount: appointment.payment?.amount || 500,
              method: paymentData.method || appointment.payment?.method,
              transactionId: paymentData.transactionId || appointment.payment?.transactionId,
              paidAt: paymentData.status === 'paid' ? new Date().toISOString() : appointment.payment?.paidAt
            };
            
            return {
              ...appointment,
              payment: updatedPayment
            };
          }
          return appointment;
        })
      );
      
      // Close modal and reset form
      setShowPaymentModal(false);
      setSelectedAppointment(null);
      setPaymentMethod('cash');
      setTransactionId('');
      setError('');
    } catch (err: any) {
      console.error('Error updating payment:', err);
      toast.error(err.response?.data?.message || 'Failed to update payment');
      setError(err.response?.data?.message || 'Failed to update payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    const paymentData: any = {
      status: 'paid'
    };

    if (paymentMethod) {
      paymentData.method = paymentMethod;
    }

    if (transactionId && paymentMethod !== 'cash') {
      paymentData.transactionId = transactionId;
    }

    updatePaymentStatus(selectedAppointment._id, paymentData);
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

  // Add UI for the payment modal
  const renderPaymentModal = () => {
    if (!selectedAppointment) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Update Payment Status
          </h2>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Appointment for: {selectedAppointment.user.firstName} {selectedAppointment.user.lastName}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Date: {formatDate(selectedAppointment.date)} at {selectedAppointment.timeSlot}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Amount: Rs. {selectedAppointment.payment?.amount || 500}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Current status: {selectedAppointment.payment?.status || 'pending'}
            </p>
          </div>
          
          <form onSubmit={handlePaymentSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                required
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="khalti">Khalti</option>
                <option value="esewa">eSewa</option>
              </select>
            </div>
            
            {paymentMethod !== 'cash' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Transaction ID
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Enter transaction ID"
                  required
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedAppointment(null);
                  setPaymentMethod('cash');
                  setTransactionId('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Mark as Paid'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Add UI for showing payment status in the appointment card
  // This should be added to the existing render logic for appointment cards

  // Inside your function that renders appointment cards, add:
  const renderPaymentStatus = (appointment: Appointment) => {
    return (
      <div className="mt-2">
        <span className="text-sm font-medium">Payment: </span>
        <span className={`text-sm ${
          appointment.payment?.status === 'paid' 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-orange-600 dark:text-orange-400'
        }`}>
          {appointment.payment?.status || 'pending'}
          {appointment.payment?.method && ` (${appointment.payment.method})`}
        </span>
        {appointment.payment?.status !== 'paid' && (
          <button
            onClick={() => {
              setSelectedAppointment(appointment);
              setShowPaymentModal(true);
            }}
            className="ml-2 text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Update
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Appointments</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex flex-col md:flex-row justify-between mb-6">
        <div className="mb-4 md:mb-0">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filter by status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="block w-full md:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Appointments</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient name or pet name"
            className="block w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">No appointments found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupAppointmentsByDate(filteredAppointments)).map(([date, appointments]) => (
            <div key={date} className="space-y-4">
              <h2 className="text-xl font-semibold">{date}</h2>
              
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                {appointments.map((appointment) => (
                  <div key={appointment._id} className="p-6">
                    <div className="flex flex-wrap justify-between items-start">
                      <div className="mb-4 md:mb-0">
                        <h3 className="text-lg font-medium">
                          {appointment.user.firstName} {appointment.user.lastName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {appointment.timeSlot} - Pet: {appointment.petName} ({appointment.petType})
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Reason: {appointment.reason}
                        </p>
                        {appointment.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="font-medium">Notes:</span> {appointment.notes}
                          </p>
                        )}
                        
                        {/* Add payment status display */}
                        {renderPaymentStatus(appointment)}
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(appointment.status)}`}>
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </span>
                        
                        <div className="flex space-x-2 mt-2">
                          {appointment.status === 'pending' && (
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')}
                              className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              Confirm
                            </button>
                          )}
                          
                          {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, 'completed')}
                              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Complete
                            </button>
                          )}
                          
                          {appointment.status !== 'cancelled' && (
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, 'cancelled')}
                              className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              Cancel
                            </button>
                          )}
                          
                          <button
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setNotes(appointment.notes || '');
                              setShowNotesModal(true);
                            }}
                            className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            Add Notes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showNotesModal && selectedAppointment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Notes</h2>
            
            <form onSubmit={handleAddNotes}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes for {selectedAppointment.user.firstName} {selectedAppointment.user.lastName}'s appointment
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any notes about the appointment"
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNotesModal(false);
                    setSelectedAppointment(null);
                    setNotes('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Add payment modal */}
      {showPaymentModal && renderPaymentModal()}
    </div>
  );
};

export default DoctorAppointments; 
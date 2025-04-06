import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { checkSession, USER_ROLES } from '../../utils/auth';

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
  cancellationReason?: string;
}

interface GroupedAppointments {
  [date: string]: Appointment[];
}

const DoctorAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [notes, setNotes] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'khalti' | 'esewa'>('cash');
  const [transactionId, setTransactionId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if doctor is logged in using the auth utility
    if (!checkSession(USER_ROLES.DOCTOR)) {
      toast.error('Please log in to access this page.');
      navigate('/doctor/login');
      return;
    }
    
    // Additional check to ensure doctorInfo exists
    const doctorInfo = localStorage.getItem('doctorInfo');
    if (!doctorInfo) {
      console.error('Doctor session exists but no doctor info found');
      toast.error('Session information incomplete. Please log in again.');
      navigate('/doctor/login');
      return;
    }
    
    // Fetch appointments
    fetchAppointments();
  }, [navigate]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      
      // Use the api instance which will automatically handle auth headers
      const response = await api.get('/appointments/doctor');
      
      console.log('Doctor appointments fetched:', response.data.length);
      
      setAppointments(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      const errorMsg = err.response?.data?.message || 'Failed to fetch appointments';
      setError(errorMsg);
      
      // The axios interceptor will handle redirects for 401/403 errors
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
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string, reason?: string) => {
    try {
      setLoading(true);
      
      // Start with the basic payload
      const payload: any = { 
        status,
        ...reason && { cancellationReason: reason }
      };
      
      // Get doctor data from localStorage - FIXED: use 'doctorInfo' instead of 'doctor'
      const doctorData = localStorage.getItem('doctorInfo');
      
      // Debug log the data (remove in production)
      console.log('Attempting to update appointment status with doctor data:', doctorData);
      
      if (!doctorData) {
        console.error('No doctor data found in localStorage. Looking for data with key "doctorInfo"');
        toast.error('Authentication required. Please log in again.');
        setTimeout(() => navigate('/doctor/login'), 1500);
        return;
      }
      
      try {
        // Parse the doctor data JSON
        const doctor = JSON.parse(doctorData);
        
        // Log the complete doctor object for debugging
        console.log('Doctor data parsed successfully:', doctor);
        
        // Ensure the doctor ID is included in the payload
        payload.doctorId = doctor._id;
        
        console.log('Updating appointment with payload:', payload);
        
        // Make the API request with the enhanced payload
        const response = await api.put(`/appointments/${appointmentId}/status`, payload);
        
        console.log('Appointment update response:', response.data);
        
        // Show success message
        toast.success(`Appointment status updated to ${status}`);
        
        // Update local state
        setAppointments(prevAppointments => 
          prevAppointments.map(appointment => 
            appointment._id === appointmentId 
              ? { ...appointment, status: status as 'pending' | 'confirmed' | 'completed' | 'cancelled', cancellationReason: reason } 
              : appointment
          )
        );
        
        setError('');
      } catch (parseError) {
        console.error('Error parsing doctor data:', parseError);
        toast.error('Invalid doctor data. Please log in again.');
        setTimeout(() => navigate('/doctor/login'), 1500);
      }
    } catch (err: any) {
      console.error('Error updating appointment:', err);
      console.error('Error details:', err.response?.data);
      
      const errorMessage = err.response?.data?.message || 'Failed to update appointment status';
      toast.error(errorMessage);
      setError(errorMessage);
      
      // Check if the error is due to authentication issues
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error('Authorization error. Please log in again as the assigned doctor.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancellation = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowCancellationModal(true);
    setCancellationReason('');
  };

  const submitCancellation = () => {
    if (!selectedAppointment || !cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    updateAppointmentStatus(selectedAppointment._id, 'cancelled', cancellationReason);
    setShowCancellationModal(false);
    setSelectedAppointment(null);
    setCancellationReason('');
  };

  const processPayment = async (appointmentId: string) => {
    try {
      // Get the appointment details
      const appointment = appointments.find(app => app._id === appointmentId);
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      // Update payment status to 'paid'
      await api.put(
        `/appointments/${appointmentId}/payment`,
        {
          status: 'paid',
          method: 'card', // Default to card payment
          transactionId: `auto-${Date.now()}` // Generate a transaction ID
        }
      );
      
      toast.success('Payment processed successfully');
      
      // Update appointment in local state
      setAppointments(prevAppointments => 
        prevAppointments.map(app => {
          if (app._id === appointmentId) {
            return {
              ...app,
              payment: {
                ...(app.payment || {}),
                status: 'paid',
                method: 'card',
                transactionId: `auto-${Date.now()}`,
                paidAt: new Date().toISOString(),
                // Ensure amount is present if it was in the original appointment
                amount: app.payment?.amount || 0
              }
            };
          }
          return app;
        })
      );
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
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
      setSelectedAppointment(null);
      setNotes('');
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
        paymentData
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
    // Filter by active/history tab
    if (filterStatus === 'active' && ['completed', 'cancelled'].includes(appointment.status)) {
      return false;
    }
    if (filterStatus === 'history' && !['completed', 'cancelled'].includes(appointment.status)) {
      return false;
    }
    
    // Apply search filter
    const userName = appointment.user 
      ? `${appointment.user?.firstName || ''} ${appointment.user?.lastName || ''}`.toLowerCase()
      : '';
    
    const matchesSearch = 
      appointment.petName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userName.includes(searchTerm.toLowerCase()) ||
      appointment.reason.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
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

  // Helper function to get user's full name from different possible data structures
  const getUserFullName = (user: any): string => {
    if (!user) return 'Unknown Patient';
    
    // If name is available as a virtual property
    if (user.name && typeof user.name === 'string' && user.name.trim() !== '') {
      return user.name;
    }
    
    // If firstName and lastName are available
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    
    // If email is available but no name
    if (user.email) {
      return user.email.split('@')[0]; // Use the part before @ as a fallback name
    }
    
    return 'Unknown Patient';
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

  // Add this useEffect to the component level, near the other useEffects
  useEffect(() => {
    // Auto-verify any pending eSewa payments
    const pendingEsewaAppointments = appointments.filter(
      app => app.payment?.status === 'pending' && app.payment?.method === 'esewa'
    );
    
    if (pendingEsewaAppointments.length === 0) return;
    
    console.log('Auto-verifying pending eSewa payments:', pendingEsewaAppointments.length);
    
    // Get doctor data for authorization if needed
    const doctorInfo = localStorage.getItem('doctorInfo');
    if (!doctorInfo) {
      console.warn('Cannot auto-verify payments: No doctor info found');
      return;
    }
    
    // Process each pending eSewa payment
    pendingEsewaAppointments.forEach(appointment => {
      console.log('Verifying eSewa payment for appointment:', appointment._id);
      
      api.post('/appointments/manual-verify', {
        appointmentId: appointment._id,
        method: 'esewa'
      })
      .then(response => {
        if (response.data.status === 'Complete') {
          console.log('Payment status updated successfully:', response.data);
          toast.success('Payment verified successfully!');
          fetchAppointments(); // Refresh the appointments list
        }
      })
      .catch(error => {
        console.error('Error verifying eSewa payment:', error);
      });
    });
  }, [appointments]);

  // Now modify the renderPaymentStatus function to remove the useEffect
  const renderPaymentStatus = (appointment: Appointment) => {
    // Check if this is a pending eSewa payment
    const isPendingEsewa = appointment.payment?.status === 'pending' && appointment.payment?.method === 'esewa';
    
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
        
        {/* Only show the regular update button for non-eSewa pending payments */}
        {!isPendingEsewa && appointment.payment?.status !== 'paid' && (
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

  // Render cancellation reason modal
  const renderCancellationModal = () => {
    if (!selectedAppointment) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Cancel Appointment
          </h2>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You are about to cancel the appointment for:
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {getUserFullName(selectedAppointment.user)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {formatDate(selectedAppointment.date)} at {selectedAppointment.timeSlot}
            </p>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for Cancellation
            </label>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              placeholder="Please provide a reason for cancelling this appointment"
              required
            ></textarea>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowCancellationModal(false);
                setSelectedAppointment(null);
                setCancellationReason('');
              }}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
            >
              Back
            </button>
            <button
              type="button"
              onClick={submitCancellation}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              disabled={loading || !cancellationReason.trim()}
            >
              {loading ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
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
            View
          </label>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                filterStatus === 'active'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Active Appointments
            </button>
            <button
              onClick={() => setFilterStatus('history')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                filterStatus === 'history'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Appointment History
            </button>
          </div>
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
            className="block w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
          />
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {filterStatus === 'active' 
              ? 'No active appointments found.' 
              : 'No appointment history found.'}
          </p>
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
                          {getUserFullName(appointment.user)}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {appointment.user?.email || ''}
                        </p>
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
                        
                        {appointment.cancellationReason && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            <span className="font-medium">Cancellation reason:</span> {appointment.cancellationReason}
                          </p>
                        )}
                        
                        {/* Payment status display */}
                        {renderPaymentStatus(appointment)}
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(appointment.status)}`}>
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </span>
                        
                        <div className="flex space-x-2 mt-2">
                          {/* For pending appointments, show Confirm and Cancel buttons */}
                          {appointment.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateAppointmentStatus(appointment._id, 'confirmed')}
                                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                              >
                                Confirm
                              </button>
                              
                              <button
                                onClick={() => handleCancellation(appointment)}
                                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          
                          {/* For confirmed appointments, show Complete button */}
                          {appointment.status === 'confirmed' && (
                            <button
                              onClick={() => updateAppointmentStatus(appointment._id, 'completed')}
                              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Complete
                            </button>
                          )}
                          
                          {/* Show notes button for all non-cancelled appointments */}
                          {appointment.status !== 'cancelled' && (
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
                          )}
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
      
      {/* Notes Modal */}
      {showNotesModal && selectedAppointment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Notes</h2>
            
            <form onSubmit={handleAddNotes}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes for {getUserFullName(selectedAppointment.user)}'s appointment
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
      
      {/* Payment modal */}
      {showPaymentModal && renderPaymentModal()}
      
      {/* Cancellation modal */}
      {showCancellationModal && renderCancellationModal()}
    </div>
  );
};

export default DoctorAppointments; 
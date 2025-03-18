import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const PLACEHOLDER_IMAGE = '/placeholder.svg';

interface Doctor {
  _id: string;
  firstName: string;
  lastName: string;
  specialization: string;
  experience: number;
  bio: string;
  profileImage?: {
    public_id: string;
    url: string;
  };
}

const BookAppointment = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState('');
  const [reason, setReason] = useState('');
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    // Check if user is authenticated
    if (!authLoading && !user) {
      navigate('/login', { state: { from: '/booking' } });
      return;
    }
    
    // Fetch doctors
    if (!authLoading && user) {
      fetchDoctors();
    }
  }, [user, authLoading, navigate]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctors');
      setDoctors(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching doctors:', err);
      setError(err.response?.data?.message || 'Failed to fetch doctors');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async (doctorId: string, date: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/doctors/available-slots/${doctorId}/${date}`);
      setAvailableSlots(response.data.availableSlots);
      setError('');
    } catch (err: any) {
      console.error('Error fetching available slots:', err);
      setError(err.response?.data?.message || 'Failed to fetch available slots');
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSelectedSlot('');
    setAvailableSlots([]);
    setBookingStep(2);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    if (selectedDoctor) {
      fetchAvailableSlots(selectedDoctor._id, date);
    }
    setSelectedSlot('');
  };

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    setBookingStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDoctor || !selectedDate || !selectedSlot || !petName || !petType || !reason) {
      setBookingError('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      
      const appointmentData = {
        doctor: selectedDoctor._id,
        date: selectedDate,
        timeSlot: selectedSlot,
        petName,
        petType,
        reason
      };
      
      await api.post('/appointments', appointmentData);
      
      setBookingSuccess(true);
      setBookingError('');
      
      // Reset form
      setPetName('');
      setPetType('');
      setReason('');
    } catch (err: any) {
      console.error('Error booking appointment:', err);
      setBookingError(err.response?.data?.message || 'Failed to book appointment');
      setBookingSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const resetBooking = () => {
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedSlot('');
    setAvailableSlots([]);
    setPetName('');
    setPetType('');
    setReason('');
    setBookingStep(1);
    setBookingSuccess(false);
    setBookingError('');
  };

  // Get min date (today) for date picker
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get max date (3 months from today) for date picker
  const getMaxDate = () => {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setMonth(today.getMonth() + 3);
    return maxDate.toISOString().split('T')[0];
  };

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

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">Book a Veterinary Appointment</h1>
      
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 dark:border-red-600 text-red-700 dark:text-red-300 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {bookingSuccess ? (
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
          <div className="text-green-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Appointment Booked Successfully!</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Your appointment with Dr. {selectedDoctor?.firstName} {selectedDoctor?.lastName} has been confirmed.
          </p>
          <button
            onClick={resetBooking}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
          >
            Book Another Appointment
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <div className="flex mb-8">
              <div className="w-full">
                <ol className="flex items-center w-full">
                  <li className={`flex items-center ${bookingStep >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full ${bookingStep >= 1 ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'} shrink-0`}>
                      1
                    </span>
                    <span className="ml-2">Select Doctor</span>
                    <span className="mx-5 text-gray-300 dark:text-gray-600">/</span>
                  </li>
                  <li className={`flex items-center ${bookingStep >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full ${bookingStep >= 2 ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'} shrink-0`}>
                      2
                    </span>
                    <span className="ml-2">Choose Date & Time</span>
                    <span className="mx-5 text-gray-300 dark:text-gray-600">/</span>
                  </li>
                  <li className={`flex items-center ${bookingStep >= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full ${bookingStep >= 3 ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'} shrink-0`}>
                      3
                    </span>
                    <span className="ml-2">Pet Details</span>
                  </li>
                </ol>
              </div>
            </div>
            
            {bookingStep === 1 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Select a Doctor</h2>
                
                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
                  </div>
                ) : doctors.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No doctors available at the moment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {doctors.map(doctor => (
                      <div 
                        key={doctor._id} 
                        className="border dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-gray-800"
                        onClick={() => handleDoctorSelect(doctor)}
                      >
                        <div className="h-[300px] bg-gray-200 dark:bg-gray-700">
                          <img 
                            src={doctor.profileImage?.url || PLACEHOLDER_IMAGE} 
                            alt={`Dr. ${doctor.firstName} ${doctor.lastName}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = PLACEHOLDER_IMAGE;
                            }}
                          />
                        </div>
                        <div className="p-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dr. {doctor.firstName} {doctor.lastName}</h3>
                          <p className="text-blue-600 dark:text-blue-400">{doctor.specialization}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{doctor.experience} years experience</p>
                          <p className="text-sm mt-2 line-clamp-2 text-gray-700 dark:text-gray-300">{doctor.bio}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {bookingStep === 2 && selectedDoctor && (
              <div>
                <div className="flex items-center mb-6">
                  <button 
                    onClick={() => setBookingStep(1)}
                    className="mr-4 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Choose Date & Time</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:w-1/2 mb-6 md:mb-0">
                    <div className="mb-4">
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Date
                      </label>
                      <input
                        type="date"
                        id="date"
                        value={selectedDate}
                        onChange={(e) => handleDateSelect(e.target.value)}
                        min={getMinDate()}
                        max={getMaxDate()}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    
                    {selectedDate && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Available time slots for {formatDate(selectedDate)}:
                        </p>
                        
                        {loading ? (
                          <div className="flex justify-center items-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <p className="text-red-500 dark:text-red-400 text-sm">No available slots for this date. Please select another date.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {availableSlots.map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => handleSlotSelect(slot)}
                                className={`px-3 py-2 text-sm rounded-md ${
                                  selectedSlot === slot
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="md:w-1/2">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Selected Doctor</h3>
                      <div className="flex items-start">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 mr-3">
                          <img 
                            src={selectedDoctor.profileImage?.url || PLACEHOLDER_IMAGE} 
                            alt={`Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = PLACEHOLDER_IMAGE;
                            }}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                          <p className="text-sm text-blue-600 dark:text-blue-400">{selectedDoctor.specialization}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedDoctor.experience} years experience</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {selectedSlot && (
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setBookingStep(3)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Continue
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {bookingStep === 3 && selectedDoctor && selectedDate && selectedSlot && (
              <div>
                <div className="flex items-center mb-6">
                  <button 
                    onClick={() => setBookingStep(2)}
                    className="mr-4 text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pet Details</h2>
                </div>
                
                {bookingError && (
                  <div className="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 dark:border-red-600 text-red-700 dark:text-red-300 p-4 mb-4">
                    <p>{bookingError}</p>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Appointment Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Doctor</p>
                      <p className="text-gray-900 dark:text-white">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Specialization</p>
                      <p className="text-gray-900 dark:text-white">{selectedDoctor.specialization}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                      <p className="text-gray-900 dark:text-white">{formatDate(selectedDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Time</p>
                      <p className="text-gray-900 dark:text-white">{selectedSlot}</p>
                    </div>
                  </div>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="petName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pet's Name
                    </label>
                    <input
                      type="text"
                      id="petName"
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="petType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pet Type
                    </label>
                    <input
                      type="text"
                      id="petType"
                      value={petType}
                      onChange={(e) => setPetType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reason for Visit
                    </label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => setBookingStep(2)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Booking...
                        </div>
                      ) : (
                        'Confirm Booking'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookAppointment; 
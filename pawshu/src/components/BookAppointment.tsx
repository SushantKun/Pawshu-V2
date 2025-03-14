import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:5000/api';
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
      const response = await axios.get(`${API_URL}/doctors`);
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
      const response = await axios.get(`${API_URL}/doctors/available-slots/${doctorId}/${date}`);
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
      
      const token = localStorage.getItem('token');
      
      await axios.post(`${API_URL}/appointments`, appointmentData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
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
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Book a Veterinary Appointment</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {bookingSuccess ? (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-6 rounded-lg text-center">
          <h2 className="text-2xl font-semibold mb-4">Appointment Booked Successfully!</h2>
          <p className="mb-6">Your appointment has been scheduled. You can view your appointments in your profile.</p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              View My Appointments
            </button>
            <button
              onClick={resetBooking}
              className="px-4 py-2 border border-blue-500 text-blue-500 rounded hover:bg-blue-50"
            >
              Book Another Appointment
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <div className="flex mb-8">
              <div className="w-full">
                <ol className="flex items-center w-full">
                  <li className={`flex items-center ${bookingStep >= 1 ? 'text-blue-600' : 'text-gray-500'}`}>
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full ${bookingStep >= 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'} shrink-0`}>
                      1
                    </span>
                    <span className="ml-2">Select Doctor</span>
                    <span className="mx-5 text-gray-300">/</span>
                  </li>
                  <li className={`flex items-center ${bookingStep >= 2 ? 'text-blue-600' : 'text-gray-500'}`}>
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full ${bookingStep >= 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'} shrink-0`}>
                      2
                    </span>
                    <span className="ml-2">Choose Date & Time</span>
                    <span className="mx-5 text-gray-300">/</span>
                  </li>
                  <li className={`flex items-center ${bookingStep >= 3 ? 'text-blue-600' : 'text-gray-500'}`}>
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full ${bookingStep >= 3 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'} shrink-0`}>
                      3
                    </span>
                    <span className="ml-2">Pet Details</span>
                  </li>
                </ol>
              </div>
            </div>
            
            {bookingStep === 1 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Select a Doctor</h2>
                
                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : doctors.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No doctors available at the moment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {doctors.map(doctor => (
                      <div 
                        key={doctor._id} 
                        className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleDoctorSelect(doctor)}
                      >
                        <div className="h-48 bg-gray-200">
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
                          <h3 className="text-lg font-semibold">Dr. {doctor.firstName} {doctor.lastName}</h3>
                          <p className="text-blue-600">{doctor.specialization}</p>
                          <p className="text-sm text-gray-600 mt-1">{doctor.experience} years experience</p>
                          <p className="text-sm mt-2 line-clamp-2">{doctor.bio}</p>
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
                    className="mr-4 text-blue-500 hover:text-blue-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold">Choose Date & Time</h2>
                </div>
                
                <div className="flex flex-col md:flex-row md:space-x-6">
                  <div className="md:w-1/2 mb-6 md:mb-0">
                    <div className="mb-4">
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                        Select Date
                      </label>
                      <input
                        type="date"
                        id="date"
                        value={selectedDate}
                        onChange={(e) => handleDateSelect(e.target.value)}
                        min={getMinDate()}
                        max={getMaxDate()}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    
                    {selectedDate && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Available time slots for {formatDate(selectedDate)}:
                        </p>
                        
                        {loading ? (
                          <div className="flex justify-center items-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <p className="text-red-500 text-sm">No available slots for this date. Please select another date.</p>
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
                                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
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
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Selected Doctor</h3>
                      <div className="flex items-start">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 mr-3">
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
                          <p className="font-medium">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                          <p className="text-sm text-blue-600">{selectedDoctor.specialization}</p>
                          <p className="text-xs text-gray-500 mt-1">{selectedDoctor.experience} years experience</p>
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
                    className="mr-4 text-blue-500 hover:text-blue-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold">Pet Details</h2>
                </div>
                
                {bookingError && (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                    <p>{bookingError}</p>
                  </div>
                )}
                
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <h3 className="font-semibold mb-2">Appointment Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Doctor</p>
                      <p>Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Specialization</p>
                      <p>{selectedDoctor.specialization}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p>{formatDate(selectedDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Time</p>
                      <p>{selectedSlot}</p>
                    </div>
                  </div>
                </div>
                
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="petName" className="block text-sm font-medium text-gray-700 mb-1">
                        Pet Name *
                      </label>
                      <input
                        type="text"
                        id="petName"
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="petType" className="block text-sm font-medium text-gray-700 mb-1">
                        Pet Type (e.g., Dog, Cat) *
                      </label>
                      <input
                        type="text"
                        id="petType"
                        value={petType}
                        onChange={(e) => setPetType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                      Reason for Visit *
                    </label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    ></textarea>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
                    >
                      {loading && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      Book Appointment
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
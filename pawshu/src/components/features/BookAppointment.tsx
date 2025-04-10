import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { SearchIcon, FilterIcon } from '@heroicons/react/outline';

const PLACEHOLDER_IMAGE = '/placeholder.svg';

interface Doctor {
  _id: string;
  firstName: string;
  lastName: string;
  specialization: string;
  experience: number;
  bio: string;
  isActive: boolean;
  locationPreference: 'clinic' | 'home_visit' | 'both';
  clinicAddress?: string;
  bookingFee: number;
  profileImage?: {
    public_id: string;
    url: string;
  };
}

const BookAppointment = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
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
  const [locationPreference, setLocationPreference] = useState<'clinic' | 'home_visit'>('clinic');
  const [address, setAddress] = useState('');

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);

  // New fields for appointment settings
  const [appointmentInfo, setAppointmentInfo] = useState({
    locationPreference: 'clinic' as 'clinic' | 'home_visit',
    doctorLocationOptions: [] as string[]
  });

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

  // Effect to filter doctors based on search and filters
  useEffect(() => {
    if (!doctors.length) return;

    let filtered = [...doctors];

    // Filter only active doctors
    filtered = filtered.filter(doctor => doctor.isActive);

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(doctor =>
        `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(search) ||
        doctor.specialization.toLowerCase().includes(search) ||
        doctor.bio.toLowerCase().includes(search)
      );
    }

    // Apply specialization filter
    if (specializationFilter) {
      filtered = filtered.filter(doctor =>
        doctor.specialization === specializationFilter
      );
    }

    // Apply location preference filter
    if (locationFilter) {
      filtered = filtered.filter(doctor =>
        doctor.locationPreference === locationFilter ||
        doctor.locationPreference === 'both'
      );
    }

    setFilteredDoctors(filtered);
  }, [doctors, searchTerm, specializationFilter, locationFilter]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctors');
      const doctorsData = response.data;

      setDoctors(doctorsData);
      setFilteredDoctors(doctorsData.filter((doc: Doctor) => doc.isActive));

      // Extract unique specializations
      const uniqueSpecializations = Array.from(
        new Set(doctorsData.map((doc: Doctor) => doc.specialization))
      );
      setSpecializations(uniqueSpecializations);

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
      console.log(`Fetching available slots for doctorId: ${doctorId}, date: ${date}, type: ${typeof date}`);

      // Validate date format before sending request
      if (!date || typeof date !== 'string' || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.error(`Invalid date format: ${date}`);
        setError('Invalid date format. Please select a valid date.');
        setAvailableSlots([]);
        setLoading(false);
        return;
      }

      const response = await api.get(`/doctors/available-slots/${doctorId}/${date}`);

      console.log('Available slots response:', response.data);

      // Get slots and location preference
      setAvailableSlots(response.data.availableSlots);

      // Set the doctor's location options
      setAppointmentInfo({
        locationPreference: response.data.locationPreference === 'home_visit' ? 'home_visit' : 'clinic',
        doctorLocationOptions:
          response.data.locationPreference === 'both'
            ? ['clinic', 'home_visit']
            : [response.data.locationPreference]
      });

      setError('');
    } catch (err: any) {
      console.error('Error fetching available slots:', err);
      const errorMsg = err.response?.data?.message || 'Failed to fetch available slots';
      console.error('Error details:', {
        status: err.response?.status,
        message: errorMsg,
        receivedDate: err.response?.data?.receivedDate
      });
      setError(errorMsg);
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

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
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

    // Validate address for home visits
    if (locationPreference === 'home_visit' && !address.trim()) {
      setBookingError('Please provide your address for home visits');
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
        reason,
        locationPreference,
        address: locationPreference === 'home_visit' ? address : undefined
      };

      const response = await api.post('/appointments', appointmentData);

      setBookingSuccess(true);
      setBookingError('');

      // Reset form
      setPetName('');
      setPetType('');
      setReason('');
      setAddress('');
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

  // Add a search and filter section to the render
  const renderSearchAndFilters = () => {
    return (
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Find a Doctor</h2>

        {/* Search bar */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input
            type="text"
            className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5"
            placeholder="Search by doctor name or specialization"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Specialization filter */}
          <div>
            <label htmlFor="specialization" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Specialization
            </label>
            <select
              id="specialization"
              className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              value={specializationFilter}
              onChange={(e) => setSpecializationFilter(e.target.value)}
            >
              <option value="">All Specializations</option>
              {specializations.map((spec) => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>

          {/* Location filter */}
          <div>
            <label htmlFor="location" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Location Preference
            </label>
            <select
              id="location"
              className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">Any Location</option>
              <option value="clinic">Clinic Only</option>
              <option value="home_visit">Home Visit Only</option>
              <option value="both">Both Options</option>
            </select>
          </div>
        </div>

        {/* Display filter info */}
        {(searchTerm || specializationFilter || locationFilter) && (
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredDoctors.length} doctors based on your search criteria.
            {filteredDoctors.length === 0 && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSpecializationFilter('');
                  setLocationFilter('');
                }}
                className="ml-2 text-blue-500 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLocationPreferenceOptions = () => {
    if (!selectedDoctor || appointmentInfo.doctorLocationOptions.length === 0) return null;

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Appointment Location
        </label>
        <div className="flex space-x-4">
          {appointmentInfo.doctorLocationOptions.includes('clinic') && (
            <div className="flex items-center">
              <input
                type="radio"
                id="locationClinic"
                name="locationPreference"
                value="clinic"
                checked={appointmentInfo.locationPreference === 'clinic'}
                onChange={() => setAppointmentInfo({
                  ...appointmentInfo,
                  locationPreference: 'clinic'
                })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="locationClinic" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Visit Clinic
              </label>
            </div>
          )}

          {appointmentInfo.doctorLocationOptions.includes('home_visit') && (
            <div className="flex items-center">
              <input
                type="radio"
                id="locationHome"
                name="locationPreference"
                value="home_visit"
                checked={appointmentInfo.locationPreference === 'home_visit'}
                onChange={() => setAppointmentInfo({
                  ...appointmentInfo,
                  locationPreference: 'home_visit'
                })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="locationHome" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Doctor Visits Home
              </label>
            </div>
          )}
        </div>

        {appointmentInfo.locationPreference === 'home_visit' && (
          <div className="mt-4">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your Address (required for home visits)
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required={appointmentInfo.locationPreference === 'home_visit'}
            />
          </div>
        )}
      </div>
    );
  };

  const renderDoctorSelection = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (filteredDoctors.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">No doctors found matching your search criteria.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDoctors.map((doctor) => (
          <div
            key={doctor._id}
            className={`bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden cursor-pointer transition-all duration-200 ${selectedDoctor?._id === doctor._id
                ? 'border-blue-500 ring-2 ring-blue-500'
                : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
              }`}
            onClick={() => handleDoctorSelect(doctor)}
          >
            <div className="p-4">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 h-14 w-14 mr-3">
                  <img
                    src={doctor.profileImage?.url || PLACEHOLDER_IMAGE}
                    alt={`Dr. ${doctor.firstName} ${doctor.lastName}`}
                    className="h-full w-full object-cover rounded-full"
                    onError={(e: any) => {
                      e.target.onerror = null;
                      e.target.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Dr. {doctor.firstName} {doctor.lastName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {doctor.specialization}
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                <p>{doctor.experience} years of experience</p>
                <p>
                  Location: {doctor.locationPreference === 'clinic'
                    ? 'Clinic Only'
                    : doctor.locationPreference === 'home_visit'
                      ? 'Home Visit Only'
                      : 'Clinic & Home Visit'}
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {doctor.bio.length > 100 ? `${doctor.bio.slice(0, 100)}...` : doctor.bio}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDateAndTimeSelection = () => {
    if (!selectedDoctor) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <img 
            src={selectedDoctor.profileImage?.url || PLACEHOLDER_IMAGE} 
            alt={`Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}`} 
            className="w-16 h-16 rounded-full object-cover"
          />
          <div>
            <h3 className="text-lg font-medium">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</h3>
            <p className="text-gray-600 dark:text-gray-400">{selectedDoctor.specialization}</p>
            <p className="text-gray-600 dark:text-gray-400">Booking Fee: NPR {selectedDoctor.bookingFee}</p>
          </div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Location Information</h4>
          {selectedDoctor.locationPreference === 'clinic' && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Clinic Address:</span> {selectedDoctor.clinicAddress || 'Not provided'}
            </p>
          )}
          {selectedDoctor.locationPreference === 'home_visit' && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              This doctor only provides home visits.
            </p>
          )}
          {selectedDoctor.locationPreference === 'both' && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Clinic Address:</span> {selectedDoctor.clinicAddress || 'Not provided'}
              <br />
              This doctor provides both clinic visits and home visits.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateSelect}
              min={getMinDate()}
              max={getMaxDate()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {selectedDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Available Time Slots
              </label>
              {loading ? (
                <div className="py-2">Loading available slots...</div>
              ) : availableSlots.length === 0 ? (
                <div className="py-2 text-red-500 dark:text-red-400">No slots available on this date</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleSlotSelect(slot)}
                      className={`py-2 px-3 text-sm rounded-md focus:outline-none ${
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

        {/* Location preference selection */}
        {(selectedDoctor.locationPreference === 'both' || appointmentInfo.doctorLocationOptions.length > 1) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location Preference
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(selectedDoctor.locationPreference === 'clinic' || selectedDoctor.locationPreference === 'both') && (
                <button
                  type="button"
                  onClick={() => setLocationPreference('clinic')}
                  className={`py-2 px-4 text-sm rounded-md border focus:outline-none ${
                    locationPreference === 'clinic'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Visit Doctor's Clinic
                </button>
              )}
              {(selectedDoctor.locationPreference === 'home_visit' || selectedDoctor.locationPreference === 'both') && (
                <button
                  type="button"
                  onClick={() => setLocationPreference('home_visit')}
                  className={`py-2 px-4 text-sm rounded-md border focus:outline-none ${
                    locationPreference === 'home_visit'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  Home Visit
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => {
              setSelectedDoctor(null);
              setBookingStep(1);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedSlot) {
                setBookingStep(3);
              } else {
                toast.warning("Please select a time slot");
              }
            }}
            disabled={!selectedSlot}
            className={`px-4 py-2 rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              selectedSlot
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    );
  };

  const renderPetInfoForm = () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot) return null;

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center space-x-4">
          <img 
            src={selectedDoctor.profileImage?.url || PLACEHOLDER_IMAGE} 
            alt={`Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}`} 
            className="w-16 h-16 rounded-full object-cover"
          />
          <div>
            <h3 className="text-lg font-medium">Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}</h3>
            <p className="text-gray-600 dark:text-gray-400">{selectedDoctor.specialization}</p>
            <p className="text-gray-600 dark:text-gray-400">
              {formatDate(selectedDate)} at {selectedSlot}
            </p>
          </div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md flex justify-between items-center">
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-300">Booking Details</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">Booking Fee: NPR {selectedDoctor.bookingFee}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Location: {locationPreference === 'clinic' ? 'Clinic Visit' : 'Home Visit'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBookingStep(2)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
          >
            Change
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pet Name
            </label>
            <input
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pet Type
            </label>
            <select
              value={petType}
              onChange={(e) => setPetType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="">Select Pet Type</option>
              <option value="Dog">Dog</option>
              <option value="Cat">Cat</option>
              <option value="Bird">Bird</option>
              <option value="Rabbit">Rabbit</option>
              <option value="Hamster">Hamster</option>
              <option value="Guinea Pig">Guinea Pig</option>
              <option value="Reptile">Reptile</option>
              <option value="Fish">Fish</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason for Visit
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            required
            placeholder="Please describe the reason for your visit"
          ></textarea>
        </div>

        {/* Home Address for home visits */}
        {locationPreference === 'home_visit' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your Home Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
              placeholder="Please provide your complete address for the home visit"
            ></textarea>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This address will be shared with the doctor for the home visit
            </p>
          </div>
        )}

        {bookingError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
            {bookingError}
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={() => setBookingStep(2)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      </form>
    );
  };

  const renderBookingSuccessMessage = () => {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Booking Successful!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Your appointment has been booked successfully. The doctor will review and confirm your appointment. You'll receive a confirmation notification once approved.
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          <strong>Note:</strong> Payment will be processed after the doctor confirms your appointment.
        </p>
        <div className="space-x-4">
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            View My Appointments
          </button>
          <button
            onClick={resetBooking}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Book Another Appointment
          </button>
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Book an Appointment</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}

      {bookingSuccess ? (
        renderBookingSuccessMessage()
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          {/* Booking Steps */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <button
              className={`flex-1 text-center py-4 px-6 ${bookingStep === 1 ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              disabled={bookingStep !== 1}
            >
              1. Select Doctor
            </button>
            <button
              className={`flex-1 text-center py-4 px-6 ${bookingStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              disabled={bookingStep !== 2}
            >
              2. Choose Date & Time
            </button>
            <button
              className={`flex-1 text-center py-4 px-6 ${bookingStep === 3 ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              disabled={bookingStep !== 3}
            >
              3. Appointment Details
            </button>
          </div>

          <div className="p-6">
            {bookingStep === 1 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Select a Doctor</h2>

                {/* Add search and filters section */}
                {renderSearchAndFilters()}

                {renderDoctorSelection()}

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setBookingStep(2)}
                    disabled={!selectedDoctor || loading}
                    className={`px-6 py-2 rounded-md ${!selectedDoctor || loading
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {bookingStep === 2 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Choose Date & Time
                </h2>

                {renderDateAndTimeSelection()}
              </div>
            )}

            {bookingStep === 3 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Appointment Details
                </h2>

                {renderPetInfoForm()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookAppointment; 
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

interface Doctor {
  _id: string;
  firstName: string;
  lastName: string;
  specialization: string;
  bio: string;
  profile?: {
    url: string;
  } | string;
  profileImage?: {
    url: string;
  };
  experience?: number;
}

const API_URL = 'http://localhost:5000/api';
const PlaceholderImage = '/placeholder.svg';

const Doctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await axios.get(`${API_URL}/doctors`);
        setDoctors(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching doctors:', err);
        setError('Failed to load doctors. Please try again later.');
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-white dark:bg-gray-900">
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg max-w-lg mx-auto">
          <h2 className="text-xl font-semibold mb-2">Error Loading Doctors</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Our Veterinarians
        </h1>
        
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto text-center mb-16">
          Meet our team of experienced veterinarians, dedicated to providing the best care for your furry friends.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {doctors.map(doctor => {
            const imageUrl = typeof doctor.profile === 'object' && doctor.profile?.url ? 
                             doctor.profile.url : 
                             doctor.profileImage?.url || 
                             (typeof doctor.profile === 'string' ? doctor.profile : null) || 
                             PlaceholderImage;

            return (
              <div key={doctor._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105">
                <div className="h-72 overflow-hidden bg-gray-200 dark:bg-gray-600">
                  <img 
                    src={imageUrl}
                    alt={`${doctor.firstName} ${doctor.lastName}`} 
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      console.log(`Image error for doctor ${doctor._id}:`, e);
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = PlaceholderImage;
                    }}
                  />
                </div>
                
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Dr. {doctor.firstName} {doctor.lastName}
                  </h2>
                  
                  <p className="text-blue-600 dark:text-blue-400 font-medium mb-4">
                    {doctor.specialization}
                    {doctor.experience && ` • ${doctor.experience} years experience`}
                  </p>
                  
                  <p className="text-gray-600 dark:text-gray-300 mb-6 line-clamp-3">
                    {doctor.bio}
                  </p>
                  
                  <Link 
                    to={`/booking?doctor=${doctor._id}`} 
                    className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md transition-colors duration-200 font-medium"
                  >
                    Book an Appointment
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        
        {doctors.length === 0 && !loading && !error && (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600 dark:text-gray-400">
              No doctors are currently available. Please check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Doctors; 
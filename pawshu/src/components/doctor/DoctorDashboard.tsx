import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import {
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { checkSession, USER_ROLES } from '../../utils/auth';

// Icon components
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const UserIconComponent = UserIcon as IconComponent;
const ClockIconComponent = ClockIcon as IconComponent;
const CheckCircleIconComponent = CheckCircleIcon as IconComponent;
const XCircleIconComponent = XCircleIcon as IconComponent;
const ClipboardDocumentCheckIconComponent = ClipboardDocumentCheckIcon as IconComponent;
const CalendarIconComponent = CalendarIcon as IconComponent;

interface Appointment {
  _id: string;
  user: {
    name?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  date: string;
  timeSlot: string;
  petName: string;
  petType: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

interface DoctorDashboardStats {
  doctorInfo: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    specialization: string;
    experience: number;
    profileImage?: {
      url: string;
    };
  };
  appointmentStats: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  recentAppointments: Appointment[];
  appointmentTrends: Array<{
    _id: {
      year: number;
      month: number;
      status: string;
    };
    count: number;
  }>;
  completionRateData: Array<{
    _id: {
      year: number;
      month: number;
    };
    completed: number;
    cancelled: number;
    total: number;
    completionRate: number;
  }>;
  performanceMetrics: {
    completionRate: string;
    cancellationRate: string;
  };
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center ${color}`}>
    <div className="rounded-full p-3 mr-4 bg-opacity-20">
      {icon}
    </div>
    <div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

// Helper function to format month and year
const formatMonthYear = (year: number, month: number) => {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

// Helper function to get user's full name from various data formats
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

const DoctorDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [stats, setStats] = useState<DoctorDashboardStats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if doctor is logged in using our utility function
    if (!checkSession(USER_ROLES.DOCTOR)) {
      toast.error('Your session has expired. Please log in again.');
      navigate('/doctor/login');
      return;
    }
    
    const storedDoctorInfo = localStorage.getItem('doctorInfo');
    if (!storedDoctorInfo) {
      navigate('/doctor/login');
      return;
    }
    
    setDoctorInfo(JSON.parse(storedDoctorInfo));
    
    // Fetch dashboard stats
    fetchDashboardStats();
  }, [navigate]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Check if doctorToken exists before making the request
      const doctorToken = localStorage.getItem('doctorToken');
      if (!doctorToken) {
        console.error('No doctor token found in localStorage');
        setError('Authentication token missing. Please log in again.');
        localStorage.removeItem('doctorInfo');
        navigate('/doctor/login');
        return;
      }
      
      console.log('Fetching doctor dashboard stats with token:', 
        doctorToken.substring(0, 10) + '...');
      
      const response = await api.get('/doctors/dashboard-stats', {
        headers: {
          Authorization: `Bearer ${doctorToken}`
        }
      });
      
      console.log('Dashboard stats response:', response.data);
      
      setStats(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      console.error('Error details:', {
        status: err.response?.status,
        message: err.response?.data?.message || err.message,
        url: '/doctors/dashboard-stats'
      });
      
      setError(err.response?.data?.message || 'Failed to fetch dashboard statistics');
      
      if (err.response?.status === 401 || err.response?.status === 403) {
        toast.error('Your session has expired or you do not have permission. Please log in again.');
        // Unauthorized, redirect to login
        localStorage.removeItem('doctorToken');
        localStorage.removeItem('doctorInfo');
        navigate('/doctor/login');
      } else {
        // Generate sample data as fallback
        toast.error('Could not connect to server. Showing sample data instead.');
        generateSampleStats();
      }
    } finally {
      setLoading(false);
    }
  };

  // Fallback function to generate sample data when API fails
  const generateSampleStats = () => {
    if (!doctorInfo) return;

    const sample: DoctorDashboardStats = {
      doctorInfo: {
        _id: doctorInfo.id || 'unknown',
        firstName: doctorInfo.firstName || 'Unknown',
        lastName: doctorInfo.lastName || 'Doctor',
        email: doctorInfo.email || 'unknown@example.com',
        specialization: doctorInfo.specialization || 'General',
        experience: 5
      },
      appointmentStats: {
        total: 25,
        pending: 8,
        confirmed: 7,
        completed: 6,
        cancelled: 4
      },
      recentAppointments: [],
      appointmentTrends: [],
      completionRateData: [],
      performanceMetrics: {
        completionRate: '75.0',
        cancellationRate: '15.0'
      }
    };

    setStats(sample);
  };

  // Prepare appointment trend data
  const prepareAppointmentTrendData = () => {
    if (!stats?.appointmentTrends) return [];

    const monthsData: Record<string, Record<string, number>> = {};
    
    stats.appointmentTrends.forEach(trend => {
      const monthKey = formatMonthYear(trend._id.year, trend._id.month);
      if (!monthsData[monthKey]) {
        monthsData[monthKey] = {
          pending: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0
        };
      }
      monthsData[monthKey][trend._id.status] = trend.count;
    });

    return Object.entries(monthsData).map(([month, statuses]) => ({
      month,
      ...statuses
    }));
  };

  // Prepare completion rate data
  const prepareCompletionRateData = () => {
    if (!stats?.completionRateData) return [];

    return stats.completionRateData.map(data => ({
      month: formatMonthYear(data._id.year, data._id.month),
      completionRate: parseFloat(data.completionRate.toFixed(1))
    }));
  };

  // Prepare appointment status distribution data for pie chart
  const prepareStatusDistributionData = () => {
    if (!stats?.appointmentStats) return [];

    return [
      { name: 'Pending', value: stats.appointmentStats.pending, color: '#fbbf24' },
      { name: 'Confirmed', value: stats.appointmentStats.confirmed, color: '#3b82f6' },
      { name: 'Completed', value: stats.appointmentStats.completed, color: '#10b981' },
      { name: 'Cancelled', value: stats.appointmentStats.cancelled, color: '#ef4444' }
    ];
  };

  // COLORS for the pie chart
  const COLORS = ['#fbbf24', '#3b82f6', '#10b981', '#ef4444'];

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
        
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : stats ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard 
                title="Total Appointments" 
                value={stats.appointmentStats.total} 
                icon={<CalendarIconComponent className="h-6 w-6 text-blue-500" />} 
                color="border-blue-500"
              />
              <StatCard 
                title="Pending Appointments" 
                value={stats.appointmentStats.pending} 
                icon={<ClockIconComponent className="h-6 w-6 text-yellow-500" />} 
                color="border-yellow-500"
              />
              <StatCard 
                title="Completed Appointments" 
                value={stats.appointmentStats.completed} 
                icon={<CheckCircleIconComponent className="h-6 w-6 text-green-500" />} 
                color="border-green-500"
              />
              <StatCard 
                title="Cancellation Rate" 
                value={`${stats.performanceMetrics.cancellationRate}%`} 
                icon={<XCircleIconComponent className="h-6 w-6 text-red-500" />} 
                color="border-red-500"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Appointment Trends Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appointment Trends</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={prepareAppointmentTrendData()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="pending" name="Pending" fill="#fbbf24" />
                      <Bar dataKey="confirmed" name="Confirmed" fill="#3b82f6" />
                      <Bar dataKey="completed" name="Completed" fill="#10b981" />
                      <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Appointment Status Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appointment Status Distribution</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={prepareStatusDistributionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {prepareStatusDistributionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} appointments`, '']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Completion Rate Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appointment Completion Rate</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={prepareCompletionRateData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} />
                    <Legend />
                    <Line type="monotone" dataKey="completionRate" name="Completion Rate" stroke="#10b981" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Appointments */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Appointments</h2>
                <button 
                  onClick={() => navigate('/doctor/appointments')} 
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
                >
                  View All
                </button>
              </div>
              
              {stats.recentAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No recent appointments found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Patient</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date & Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {stats.recentAppointments.map((appointment) => (
                        <tr key={appointment._id}>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {getUserFullName(appointment.user)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {appointment.user && appointment.user.email ? appointment.user.email : 'No email provided'}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {appointment.date ? new Date(appointment.date).toLocaleDateString() : 'No date'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {appointment.timeSlot || 'No time specified'}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${appointment.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : ''}
                              ${appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' : ''}
                              ${appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' : ''}
                              ${appointment.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100' : ''}
                            `}>
                              {appointment.status ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1) : 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <ClipboardDocumentCheckIconComponent className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Data Available</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Could not fetch dashboard statistics at this moment.</p>
            <button 
              onClick={fetchDashboardStats}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard; 
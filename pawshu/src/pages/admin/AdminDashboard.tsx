import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBagIcon,
  UserIcon, 
  CurrencyDollarIcon, 
  ClockIcon,
  HeartIcon,
  UserGroupIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, ResponsiveContainer } from 'recharts';
import { checkSession, USER_ROLES } from '../../utils/auth';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const UserIconComponent = UserIcon as IconComponent;
const CurrencyDollarIconComponent = CurrencyDollarIcon as IconComponent;
const ClockIconComponent = ClockIcon as IconComponent;
const HeartIconComponent = HeartIcon as IconComponent;
const UserGroupIconComponent = UserGroupIcon as IconComponent;
const BuildingOfficeIconComponent = BuildingOfficeIcon as IconComponent;
const ShoppingBagIconComponent = ShoppingBagIcon as IconComponent;

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

interface DashboardStats {
  counts: {
    users: number;
    doctors: number;
    appointments: {
      total: number;
      pending: number;
      confirmed: number;
      completed: number;
      cancelled: number;
    };
    charities: number;
    donations: {
      totalAmount: number;
      count: number;
      avgAmount: number;
      maxAmount: number;
      minAmount: number;
    };
    orders: {
      total: number;
      revenue: number;
    };
  };
  revenue: number;
  revenueData: Array<{
    date: string;
    amount: number;
  }>;
  userGrowthData: Array<{
    date: string;
    users: number;
  }>;
  recentOrders: Array<{
    _id: string;
    user: {
      name: string;
    };
    total: number;
    status: string;
  }>;
  trends: {
    monthlyDonations: Array<{
      _id: { year: number; month: number };
      total: number;
      count: number;
    }>;
    monthlyAppointments: Array<{
      _id: { year: number; month: number };
      total: number;
      pending: number;
      confirmed: number;
      completed: number;
      cancelled: number;
    }>;
  };
  recent: {
    donations: Array<{
      _id: string;
      userName: string;
      charityName: string;
      amount: number;
      date: string;
      status: string;
    }>;
    appointments: Array<{
      _id: string;
      user: { name: string };
      doctor: { firstName: string; lastName: string; specialization: string };
      date: string;
      status: string;
    }>;
    users: Array<{
      _id: string;
      name: string;
      email: string;
      createdAt: string;
    }>;
    orders: Array<{
      _id: string;
      userId: { name: string };
      totalAmount: number;
      createdAt: string;
    }>;
  };
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => (
  <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center ${color}`}>
    <div className="rounded-full p-3 mr-4 bg-opacity-20">
      {icon}
    </div>
    <div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

// Helper functions for generating dummy data
const generateDummyData = (months: number) => {
  const data = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(now.getMonth() - i);
    
    data.push({
      date: `${date.getFullYear()}-${date.getMonth() + 1}`,
      amount: Math.floor(Math.random() * 4000) + 1000
    });
  }
  
  return data;
};

const generateUserGrowthData = (months: number) => {
  const data = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(now.getMonth() - i);
    
    data.push({
      date: `${date.getFullYear()}-${date.getMonth() + 1}`,
      users: Math.floor(Math.random() * 9) + 1
    });
  }
  
  return data;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    counts: {
      users: 0,
      doctors: 0,
      appointments: {
        total: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0
      },
      charities: 0,
      donations: {
        totalAmount: 0,
        count: 0,
        avgAmount: 0,
        maxAmount: 0,
        minAmount: 0
      },
      orders: {
        total: 0,
        revenue: 0
      }
    },
    revenue: 0,
    revenueData: [],
    userGrowthData: [],
    recentOrders: [],
    trends: {
      monthlyDonations: [],
      monthlyAppointments: []
    },
    recent: {
      donations: [],
      appointments: [],
      users: [],
      orders: []
    }
  });
  const [chartData, setChartData] = useState({
    revenueData: [],
    userGrowthData: []
  });
  const [error, setError] = useState<string | null>(null);

  // Check session validity on mount and on interval
  useEffect(() => {
    // Check if admin session is valid
    if (!checkSession(USER_ROLES.ADMIN)) {
      toast.error('Your session has expired. Please log in again.');
      navigate('/admin/login');
      return;
    }

    // Set up periodic session checks
    const sessionCheckInterval = setInterval(() => {
      if (!checkSession(USER_ROLES.ADMIN)) {
        toast.error('Your session has expired. Please log in again.');
        clearInterval(sessionCheckInterval);
        navigate('/admin/login');
      }
    }, 60000); // Check every minute

    // Clean up interval on unmount
    return () => clearInterval(sessionCheckInterval);
  }, [navigate]);

  const testServerConnection = async () => {
    try {
      const response = await api.get('/admin/test');
      console.log('Server test result:', response.data);
    } catch (err) {
      console.error('Error testing server connection:', err);
    }
  };

  const testAuthConnection = async () => {
    try {
      const response = await api.get('/admin/test-auth');
      console.log('Auth test result:', response.data);
    } catch (err) {
      console.error('Error testing auth connection:', err);
    }
  };

  const testHealthEndpoint = async () => {
    try {
      console.log('Testing health endpoint...');
      const response = await fetch('http://localhost:5000/api/admin/health');
      const data = await response.json();
      console.log('Health check result:', data);
      return data;
    } catch (err) {
      console.error('Error testing health endpoint:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchChartData();
    testServerConnection();
    testAuthConnection();
    testHealthEndpoint();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      console.log('Fetching dashboard stats...');
      
      // Try direct fetch for diagnosis
      try {
        console.log('Trying direct fetch to dashboard-stats endpoint...');
        const directResponse = await fetch('http://localhost:5000/api/admin/dashboard-stats', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        });
        const directData = await directResponse.json();
        console.log('Direct fetch response:', directData);
        
        // If direct fetch succeeds, use the data
        setStats(directData);
        setError(null);
        setLoading(false);
        return;
      } catch (directErr) {
        console.error('Direct fetch failed:', directErr);
        // Continue with axios as fallback
      }
      
      const response = await api.get('/admin/dashboard-stats');
      console.log('Dashboard stats response:', response.data);
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      // Capture more detailed error information
      const errorMessage = err.response?.data?.message || 'Failed to fetch dashboard statistics';
      const errorStatus = err.response?.status || 'Unknown status';
      const errorDetails = err.response?.data?.error || err.message || 'No details available';
      
      setError(`Error (${errorStatus}): ${errorMessage}. Details: ${errorDetails}`);
      
      // Fallback to dummy data when the API fails
      setStats({
        counts: {
          users: 25,
          doctors: 5,
          appointments: {
            total: 30,
            pending: 10,
            confirmed: 8,
            completed: 7,
            cancelled: 5
          },
          charities: 3,
          donations: {
            totalAmount: 25000,
            count: 15,
            avgAmount: 1666,
            maxAmount: 5000,
            minAmount: 500
          },
          orders: {
            total: 18,
            revenue: 36000
          }
        },
        revenue: 61000,
        revenueData: generateDummyData(6),
        userGrowthData: generateUserGrowthData(6),
        recentOrders: [],
        trends: {
          monthlyDonations: [],
          monthlyAppointments: []
        },
        recent: {
          donations: [],
          appointments: [],
          users: [],
          orders: []
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      console.log('Fetching chart data...');
      const response = await api.get('/admin/chart-stats');
      console.log('Chart data response:', response.data);
      
      const { userRegistrationTrends = [], orderTrends = [] } = response.data || {};

      // Format revenue data safely
      const revenueData = (orderTrends || []).map((trend: any) => ({
        date: trend?._id?.year && trend?._id?.month ? `${trend._id.year}-${trend._id.month}` : 'Unknown',
        amount: trend?.totalAmount || 0
      }));

      // Format user growth data safely
      const userGrowthData = (userRegistrationTrends || []).map((trend: any) => ({
        date: trend?._id?.year && trend?._id?.month ? `${trend._id.year}-${trend._id.month}` : 'Unknown',
        users: trend?.count || 0
      }));

      setChartData({
        revenueData,
        userGrowthData
      });
    } catch (err: any) {
      console.error('Error fetching chart data:', err);
      // Don't set an error state here, but log it clearly
      const errorMessage = err.response?.data?.message || 'Failed to fetch chart data';
      const errorStatus = err.response?.status || 'Unknown status';
      
      console.error(`Chart data error (${errorStatus}): ${errorMessage}`);
      
      // Set empty chart data as fallback
      setChartData({
        revenueData: [],
        userGrowthData: []
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-400 dark:border-red-600 p-4 mb-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <div className="flex space-x-2">
              <button
                onClick={fetchDashboardStats}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Users"
              value={stats?.counts?.users?.toString() || '0'}
              icon={<UserGroupIconComponent className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
              color="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              title="Total Orders"
              value={stats?.counts?.orders?.total?.toString() || '0'}
              icon={<ShoppingBagIconComponent className="h-6 w-6 text-green-600 dark:text-green-400" />}
              color="text-green-600 dark:text-green-400"
            />
            <StatCard
              title="Total Revenue"
              value={`NPR ${(stats?.revenue || 0).toLocaleString()}`}
              icon={<CurrencyDollarIconComponent className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />}
              color="text-yellow-600 dark:text-yellow-400"
            />
            <StatCard
              title="Total Donations"
              value={`NPR ${(stats?.counts?.donations?.totalAmount || 0).toLocaleString()}`}
              icon={<HeartIconComponent className="h-6 w-6 text-red-600 dark:text-red-400" />}
              color="text-red-600 dark:text-red-400"
            />
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Quick Stats</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Appointments</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.counts?.appointments?.pending || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Completed Appointments</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.counts?.appointments?.completed || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Doctors</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.counts?.doctors || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Charities</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.counts?.charities || 0}</p>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Revenue Overview</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                    <XAxis 
                      dataKey="date" 
                      className="text-gray-500 dark:text-gray-400"
                      tick={{ fill: '#9CA3AF' }}
                    />
                    <YAxis 
                      className="text-gray-500 dark:text-gray-400"
                      tick={{ fill: '#9CA3AF' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '0.5rem',
                        color: '#F9FAFB'
                      }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* User Growth Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">User Growth</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                    <XAxis 
                      dataKey="date" 
                      className="text-gray-500 dark:text-gray-400"
                      tick={{ fill: '#9CA3AF' }}
                    />
                    <YAxis 
                      className="text-gray-500 dark:text-gray-400"
                      tick={{ fill: '#9CA3AF' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '0.5rem',
                        color: '#F9FAFB'
                      }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="users" 
                      stroke="#10B981" 
                      fill="#059669" 
                      fillOpacity={0.2}
                      dot={{ fill: '#10B981', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Activity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Orders</h2>
              <div className="space-y-4">
                {stats?.recent?.orders?.map((order: any) => (
                  <div key={order._id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {order.userId && order.userId.name ? order.userId.name : 'Unknown User'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Order #{order._id?.slice(-6) || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">NPR {(order.totalAmount || 0).toLocaleString()}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Appointments */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Appointments</h2>
              <div className="space-y-4">
                {stats?.recent?.appointments?.map((appointment: any) => (
                  <div key={appointment._id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {appointment.user && appointment.user.name ? appointment.user.name : 'Unknown User'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Dr. {appointment.doctor?.firstName || ''} {appointment.doctor?.lastName || ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">{appointment.status || 'Unknown'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {appointment.date ? new Date(appointment.date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
import { useState, useEffect } from 'react';
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
import api from '../api/axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, ResponsiveContainer } from 'recharts';

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

const AdminDashboard = () => {
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

  useEffect(() => {
    fetchDashboardStats();
    fetchChartData();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard-stats');
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.response?.data?.message || 'Failed to fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      const response = await api.get('/admin/chart-stats');
      const { userRegistrationTrends, orderTrends } = response.data;

      // Format revenue data
      const revenueData = orderTrends.map((trend: any) => ({
        date: `${trend._id.year}-${trend._id.month}`,
        amount: trend.totalAmount
      }));

      // Format user growth data
      const userGrowthData = userRegistrationTrends.map((trend: any) => ({
        date: `${trend._id.year}-${trend._id.month}`,
        users: trend.count
      }));

      setChartData({
        revenueData,
        userGrowthData
      });
    } catch (err) {
      console.error('Error fetching chart data:', err);
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
              value={`Rs. ${(stats?.revenue || 0).toLocaleString()}`}
              icon={<CurrencyDollarIconComponent className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />}
              color="text-yellow-600 dark:text-yellow-400"
            />
            <StatCard
              title="Total Donations"
              value={`Rs. ${(stats?.counts?.donations?.totalAmount || 0).toLocaleString()}`}
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
                      <p className="font-medium text-gray-900 dark:text-white">{order.userId?.name || 'Unknown User'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Order #{order._id.slice(-6)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">Rs. {order.totalAmount.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
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
                      <p className="font-medium text-gray-900 dark:text-white">{appointment.user?.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Dr. {appointment.doctor?.firstName} {appointment.doctor?.lastName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">{appointment.status}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(appointment.date).toLocaleDateString()}</p>
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
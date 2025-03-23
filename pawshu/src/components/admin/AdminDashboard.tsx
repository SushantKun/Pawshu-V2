import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaUsers, FaShoppingCart, FaMoneyBillWave, FaDonate } from 'react-icons/fa';

interface DashboardStat {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalDonations: 0,
    totalDoctors: 0,
    totalCharities: 0,
    pendingAppointments: 0,
    completedAppointments: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the admin token
      const adminToken = localStorage.getItem('adminToken');
      
      if (!adminToken) {
        setError('Admin authentication required');
        setLoading(false);
        return;
      }
      
      // Test the auth endpoint first to verify we have valid permissions
      console.log('Testing admin authentication...');
      try {
        const testResponse = await axios.get(`${import.meta.env.VITE_API_URL}/admin/test-auth`, {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        });
        console.log('Server test result:', testResponse.data);
      } catch (testError) {
        console.error('Auth test failed:', testError);
        throw new Error('Authorization failed. Admin privileges required.');
      }
      
      // Check MongoDB health
      console.log('Checking server health...');
      try {
        const healthResponse = await axios.get(`${import.meta.env.VITE_API_URL}/health`, {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        });
        console.log('Health check result:', healthResponse.data);
      } catch (healthError) {
        console.error('Health check failed:', healthError);
        // Non-critical, continue with dashboard
      }
      
      // Direct fetch instead of using API instance
      console.log('Fetching dashboard stats...');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/admin/dashboard`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      
      console.log('Direct fetch response:', response.data);
      
      if (response.data) {
        setStats({
          totalUsers: response.data.totalUsers || 0,
          totalOrders: response.data.totalOrders || 0,
          totalRevenue: response.data.totalRevenue || 0,
          totalDonations: response.data.totalDonations || 0,
          totalDoctors: response.data.totalDoctors || 0,
          totalCharities: response.data.totalCharities || 0,
          pendingAppointments: response.data.pendingAppointments || 0,
          completedAppointments: response.data.completedAppointments || 0
        });
      }
    } catch (err: any) {
      console.error('Error fetching admin dashboard data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchDashboardData();
  };

  const mainStats: DashboardStat[] = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: <FaUsers className="text-3xl" />,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: <FaShoppingCart className="text-3xl" />,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    },
    {
      title: 'Total Revenue',
      value: `NPR ${stats.totalRevenue}`,
      icon: <FaMoneyBillWave className="text-3xl" />,
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
    },
    {
      title: 'Total Donations',
      value: `NPR ${stats.totalDonations}`,
      icon: <FaDonate className="text-3xl" />,
      color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <button
          onClick={refreshData}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300">
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {mainStats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className={`inline-block p-3 rounded-lg ${stat.color} mb-4`}>
              {stat.icon}
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{stat.title}</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Appointments</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingAppointments}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed Appointments</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedAppointments}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Doctors</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalDoctors}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Charities</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCharities}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Revenue Overview</h2>
          {/* Revenue chart would go here */}
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Revenue chart will be displayed here</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">User Growth</h2>
          {/* User growth chart would go here */}
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">User growth chart will be displayed here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

 
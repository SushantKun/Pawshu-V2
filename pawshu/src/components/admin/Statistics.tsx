import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../../api/axios';
import { toast } from 'react-toastify';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface DetailedStats {
  userRegistrationTrends: Array<{
    _id: { year: number; month: number };
    count: number;
  }>;
  appointmentsByStatus: Array<{
    _id: string;
    count: number;
  }>;
  appointmentTrends: Array<{
    _id: { year: number; month: number; status: string };
    count: number;
  }>;
  doctorStats: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    specialization: string;
    appointmentCount: number;
    completedAppointments: number;
  }>;
  donationStats: {
    totalAmount: number;
    count: number;
    avgAmount: number;
  };
  donationTrends: Array<{
    _id: { year: number; month: number };
    totalAmount: number;
    count: number;
  }>;
  donationsByCharity: Array<{
    _id: string;
    totalAmount: number;
    count: number;
  }>;
  orderStats: {
    totalAmount: number;
    count: number;
    avgAmount: number;
  };
  orderTrends: Array<{
    _id: { year: number; month: number };
    totalAmount: number;
    count: number;
  }>;
  ordersByStatus: Array<{
    _id: string;
    count: number;
    totalAmount: number;
  }>;
  totalRevenue: number;
  userActivityMetrics: {
    totalActiveUsers: number;
    usersWithAppointments: number;
    usersWithDonations: number;
    usersWithOrders: number;
  };
}

const Statistics = () => {
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/detailed-stats');
      setStats(response.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching statistics:', err);
      setError(err.response?.data?.message || 'Failed to fetch statistics');
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatMonthYear = (year: number, month: number) => {
    return new Date(year, month - 1).toLocaleDateString('ne-NP', { month: 'short', year: 'numeric' });
  };

  const formatNPR = (amount: number) => {
    return `NPR ${amount.toLocaleString('ne-NP')}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
        <p>{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Prepare data for User Registration Trends with bar chart
  const userRegistrationData = {
    labels: stats.userRegistrationTrends.map(trend => 
      formatMonthYear(trend._id.year, trend._id.month)
    ),
    datasets: [
      {
        label: 'New Users',
        data: stats.userRegistrationTrends.map(trend => trend.count),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1
      }
    ]
  };

  // Prepare data for Donation Trends with bar chart
  const donationTrendsData = {
    labels: stats.donationTrends.map(trend => 
      formatMonthYear(trend._id.year, trend._id.month)
    ),
    datasets: [
      {
        label: 'Total Donations (NPR)',
        data: stats.donationTrends.map(trend => trend.totalAmount),
        backgroundColor: 'rgba(255, 99, 132, 0.7)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1
      }
    ]
  };

  // Prepare data for Order Trends with bar chart
  const orderTrendsData = {
    labels: stats.orderTrends?.map(trend => 
      formatMonthYear(trend._id.year, trend._id.month)
    ) || [],
    datasets: [
      {
        label: 'Total Orders (NPR)',
        data: stats.orderTrends?.map(trend => trend.totalAmount) || [],
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1
      }
    ]
  };

  // Prepare data for Appointments by Status chart
  const appointmentStatusData = {
    labels: stats.appointmentsByStatus.map(status => 
      status._id.charAt(0).toUpperCase() + status._id.slice(1)
    ),
    datasets: [{
      data: stats.appointmentsByStatus.map(status => status.count),
      backgroundColor: [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)'
      ]
    }]
  };

  // Prepare data for Doctor Performance chart
  const doctorPerformanceData = {
    labels: stats.doctorStats.map(doc => `Dr. ${doc.firstName} ${doc.lastName}`),
    datasets: [
      {
        label: 'Total Appointments',
        data: stats.doctorStats.map(doc => doc.appointmentCount),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
      },
      {
        label: 'Completed Appointments',
        data: stats.doctorStats.map(doc => doc.completedAppointments),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      }
    ]
  };

  // Prepare data for Donations by Charity chart
  const donationsByCharityData = {
    labels: stats.donationsByCharity.map(charity => charity._id),
    datasets: [{
      data: stats.donationsByCharity.map(charity => charity.totalAmount),
      backgroundColor: [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)',
        'rgba(153, 102, 255, 0.5)'
      ]
    }]
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* User Activity Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">User Activity</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.userActivityMetrics.totalActiveUsers}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Active Users</p>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.userActivityMetrics.usersWithAppointments}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">With Appointments</p>
            </div>
            <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.userActivityMetrics.usersWithDonations}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">With Donations</p>
            </div>
            <div className="text-center p-2 bg-pink-50 dark:bg-pink-900/30 rounded-lg">
              <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                {stats.userActivityMetrics.usersWithOrders || 0}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">With Orders</p>
            </div>
          </div>
        </div>

        {/* Donations Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Charity Donations</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatNPR(stats.donationStats.totalAmount)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Donations</p>
            </div>
            <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.donationStats.count}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Donation Count</p>
            </div>
            <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg col-span-2">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatNPR(stats.donationStats.avgAmount)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Average Donation</p>
            </div>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Business Revenue</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatNPR(stats.orderStats?.totalAmount || 0)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Product Sales</p>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.orderStats?.count || 0}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Order Count</p>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg col-span-2">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatNPR(stats.orderStats?.avgAmount || 0)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Average Order</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">User Registration Trends</h2>
          <div style={{ height: '250px' }}>
            <Bar 
              data={userRegistrationData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#000',
                    bodyColor: '#000',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 8,
                    displayColors: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: {
                      color: 'rgba(156, 163, 175, 0.2)'
                    }
                  },
                  x: {
                    grid: {
                      color: 'rgba(156, 163, 175, 0.2)'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Appointments by Status</h2>
          <div style={{ height: '250px' }}>
            <Doughnut 
              data={appointmentStatusData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'right', 
                    labels: { 
                      boxWidth: 12, 
                      font: { size: 11 },
                      color: 'rgb(156, 163, 175)'
                    } 
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Donation Trends</h2>
          <div style={{ height: '250px' }}>
            <Bar 
              data={donationTrendsData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'NPR',
                      font: { size: 10 },
                      color: 'rgb(156, 163, 175)'
                    },
                    grid: {
                      color: 'rgba(156, 163, 175, 0.2)'
                    },
                    ticks: {
                      color: 'rgb(156, 163, 175)'
                    }
                  },
                  x: {
                    grid: {
                      color: 'rgba(156, 163, 175, 0.2)'
                    },
                    ticks: {
                      color: 'rgb(156, 163, 175)'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Donations by Charity</h2>
          <div style={{ height: '250px' }}>
            <Pie 
              data={donationsByCharityData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'right', 
                    labels: { 
                      boxWidth: 12, 
                      font: { size: 11 },
                      color: 'rgb(156, 163, 175)'
                    } 
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Product Sales Trends</h2>
          <div style={{ height: '250px' }}>
            <Bar 
              data={orderTrendsData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'NPR',
                      font: { size: 10 },
                      color: 'rgb(156, 163, 175)'
                    },
                    grid: {
                      color: 'rgba(156, 163, 175, 0.2)'
                    },
                    ticks: {
                      color: 'rgb(156, 163, 175)'
                    }
                  },
                  x: {
                    grid: {
                      color: 'rgba(156, 163, 175, 0.2)'
                    },
                    ticks: {
                      color: 'rgb(156, 163, 175)'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Doctor Performance</h2>
          <div style={{ height: '250px' }}>
            <Bar 
              data={doctorPerformanceData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'top', 
                    labels: { 
                      boxWidth: 12, 
                      font: { size: 11 },
                      color: 'rgb(156, 163, 175)'
                    } 
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      color: 'rgba(156, 163, 175, 0.2)'
                    },
                    ticks: {
                      color: 'rgb(156, 163, 175)'
                    }
                  },
                  x: {
                    grid: {
                      color: 'rgba(156, 163, 175, 0.2)'
                    },
                    ticks: {
                      color: 'rgb(156, 163, 175)'
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <h2 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-300 border-b dark:border-gray-700 pb-2">Statistics Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-3 rounded-lg shadow-sm">
            <h3 className="font-medium text-blue-700 dark:text-blue-400 mb-2 text-sm border-b border-blue-200 dark:border-blue-700 pb-1">Appointments</h3>
            <ul className="space-y-1 text-sm">
              {stats.appointmentsByStatus.map(status => (
                <li key={status._id} className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300">{status._id.charAt(0).toUpperCase() + status._id.slice(1)}:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{status.count}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-3 rounded-lg shadow-sm">
            <h3 className="font-medium text-purple-700 dark:text-purple-400 mb-2 text-sm border-b border-purple-200 dark:border-purple-700 pb-1">Donations</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Total Count:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{stats.donationStats.count}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Total Amount:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{formatNPR(stats.donationStats.totalAmount)}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Average Donation:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{formatNPR(stats.donationStats.avgAmount)}</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-3 rounded-lg shadow-sm">
            <h3 className="font-medium text-blue-700 dark:text-blue-400 mb-2 text-sm border-b border-blue-200 dark:border-blue-700 pb-1">Orders</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Total Count:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{stats.orderStats?.count || 0}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Total Amount:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{formatNPR(stats.orderStats?.totalAmount || 0)}</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Average Order:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{formatNPR(stats.orderStats?.avgAmount || 0)}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics; 
import { useState, useEffect } from 'react';
import { 
  ShoppingCartIcon, 
  UserIcon, 
  CurrencyDollarIcon, 
  ClockIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import api from '../api/axios';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const ShoppingCartIconComponent = ShoppingCartIcon as IconComponent;
const UserIconComponent = UserIcon as IconComponent;
const CurrencyDollarIconComponent = CurrencyDollarIcon as IconComponent;
const ClockIconComponent = ClockIcon as IconComponent;
const HeartIconComponent = HeartIcon as IconComponent;

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

interface DonationStats {
  total: {
    totalAmount: number;
    count: number;
  };
  charityStats: {
    _id: string;
    charityName: string;
    totalAmount: number;
    count: number;
  }[];
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => (
  <div className={`bg-white rounded-lg shadow-md p-6 flex items-center ${color}`}>
    <div className="rounded-full p-3 mr-4 bg-opacity-20">
      {icon}
    </div>
    <div>
      <p className="text-gray-500 text-sm">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
    pendingOrders: 0
  });
  const [donationStats, setDonationStats] = useState<DonationStats>({
    total: { totalAmount: 0, count: 0 },
    charityStats: []
  });
  const [recentDonations, setRecentDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDonationStats();
    fetchRecentDonations();
  }, []);

  const fetchDonationStats = async () => {
    try {
      const response = await api.get('/donations/stats');
      setDonationStats(response.data);
    } catch (error) {
      console.error('Error fetching donation stats:', error);
    }
  };

  const fetchRecentDonations = async () => {
    try {
      const response = await api.get('/donations/all');
      setRecentDonations(response.data);
    } catch (error) {
      console.error('Error fetching recent donations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex space-x-2">
          <button 
            onClick={() => {
              fetchDonationStats();
              fetchRecentDonations();
            }}
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Donations" 
          value={donationStats.total.count} 
          icon={<HeartIconComponent className="h-6 w-6 text-red-600" />} 
          color="border-l-4 border-red-600" 
        />
        <StatCard 
          title="Total Amount Donated" 
          value={`Rs. ${donationStats.total.totalAmount.toLocaleString()}`} 
          icon={<CurrencyDollarIconComponent className="h-6 w-6 text-green-600" />} 
          color="border-l-4 border-green-600" 
        />
        <StatCard 
          title="Active Charities" 
          value={donationStats.charityStats.length} 
          icon={<UserIconComponent className="h-6 w-6 text-blue-600" />} 
          color="border-l-4 border-blue-600" 
        />
        <StatCard 
          title="Average Donation" 
          value={`Rs. ${donationStats.total.count > 0 
            ? Math.round(donationStats.total.totalAmount / donationStats.total.count).toLocaleString()
            : 0}`} 
          icon={<ClockIconComponent className="h-6 w-6 text-yellow-600" />} 
          color="border-l-4 border-yellow-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Donations</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Donor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Charity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentDonations.slice(0, 5).map((donation) => (
                    <tr key={donation._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {donation.userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {donation.charityName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Rs. {donation.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(donation.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Charity Statistics</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {donationStats.charityStats.map((charity) => (
                <div key={charity._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{charity.charityName}</h3>
                    <p className="text-sm text-gray-500">{charity.count} donations</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      Rs. {charity.totalAmount.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Avg: Rs. {Math.round(charity.totalAmount / charity.count).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
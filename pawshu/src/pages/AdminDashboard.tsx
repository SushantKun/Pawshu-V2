import { useState, useEffect } from 'react';
import { 
  ShoppingCartIcon, 
  UserIcon, 
  CurrencyDollarIcon, 
  ClockIcon 
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const ShoppingCartIconComponent = ShoppingCartIcon as IconComponent;
const UserIconComponent = UserIcon as IconComponent;
const CurrencyDollarIconComponent = CurrencyDollarIcon as IconComponent;
const ClockIconComponent = ClockIcon as IconComponent;

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
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

  // Simulate fetching data
  useEffect(() => {
    // In a real app, this would be an API call
    setTimeout(() => {
      setStats({
        totalOrders: 156,
        totalUsers: 42,
        totalRevenue: 8245.50,
        pendingOrders: 13
      });
    }, 1000);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex space-x-2">
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
            Export
          </button>
          <button className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Orders" 
          value={stats.totalOrders} 
          icon={<ShoppingCartIconComponent className="h-6 w-6 text-blue-600" />} 
          color="border-l-4 border-blue-600" 
        />
        <StatCard 
          title="Total Users" 
          value={stats.totalUsers} 
          icon={<UserIconComponent className="h-6 w-6 text-green-600" />} 
          color="border-l-4 border-green-600" 
        />
        <StatCard 
          title="Total Revenue" 
          value={`$${stats.totalRevenue.toFixed(2)}`} 
          icon={<CurrencyDollarIconComponent className="h-6 w-6 text-yellow-600" />} 
          color="border-l-4 border-yellow-600" 
        />
        <StatCard 
          title="Pending Orders" 
          value={stats.pendingOrders} 
          icon={<ClockIconComponent className="h-6 w-6 text-red-600" />} 
          color="border-l-4 border-red-600" 
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#ORD-001</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">John Doe</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2023-05-15</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$125.00</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Completed
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#ORD-002</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Jane Smith</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2023-05-14</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$75.50</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    Processing
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#ORD-003</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Robert Johnson</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2023-05-13</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$250.00</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                    Cancelled
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Popular Products</h2>
          <ul className="divide-y divide-gray-200">
            <li className="py-3 flex justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 rounded-md mr-3"></div>
                <span>Premium Dog Food</span>
              </div>
              <span className="text-green-600 font-medium">$29.99</span>
            </li>
            <li className="py-3 flex justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 rounded-md mr-3"></div>
                <span>Cat Scratching Post</span>
              </div>
              <span className="text-green-600 font-medium">$39.99</span>
            </li>
            <li className="py-3 flex justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 rounded-md mr-3"></div>
                <span>Pet Carrier</span>
              </div>
              <span className="text-green-600 font-medium">$45.50</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activities</h2>
          <ul className="divide-y divide-gray-200">
            <li className="py-3">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <UserIconComponent className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm">New user registered</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
            </li>
            <li className="py-3">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <ShoppingCartIconComponent className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm">New order placed</p>
                  <p className="text-xs text-gray-500">5 hours ago</p>
                </div>
              </div>
            </li>
            <li className="py-3">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                  <CurrencyDollarIconComponent className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm">Payment received</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
import { useState } from 'react';
import { 
  ChartBarIcon, 
  ChartPieIcon, 
  ArrowUpIcon, 
  ArrowDownIcon 
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const ChartBarIconComponent = ChartBarIcon as IconComponent;
const ChartPieIconComponent = ChartPieIcon as IconComponent;
const ArrowUpIconComponent = ArrowUpIcon as IconComponent;
const ArrowDownIconComponent = ArrowDownIcon as IconComponent;

interface StatCardProps {
  title: string;
  value: string | number;
  change: number;
  timeframe: string;
  icon: React.ReactNode;
}

const StatCard = ({ title, value, change, timeframe, icon }: StatCardProps) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-gray-500 text-sm">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        <div className="flex items-center mt-2">
          {change > 0 ? (
            <ArrowUpIconComponent className="h-4 w-4 text-green-500 mr-1" />
          ) : (
            <ArrowDownIconComponent className="h-4 w-4 text-red-500 mr-1" />
          )}
          <span className={change > 0 ? "text-green-500" : "text-red-500"}>
            {Math.abs(change)}%
          </span>
          <span className="text-gray-500 text-sm ml-1">vs {timeframe}</span>
        </div>
      </div>
      <div className="p-3 bg-blue-100 rounded-full">
        {icon}
      </div>
    </div>
  </div>
);

const AdminStats = () => {
  const [timeframe, setTimeframe] = useState('month');

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Statistics</h1>
        <div className="flex space-x-2">
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
          <button className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700">
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Sales" 
          value="$12,426" 
          change={8.2} 
          timeframe="last month" 
          icon={<ChartBarIconComponent className="h-6 w-6 text-blue-600" />} 
        />
        <StatCard 
          title="Average Order Value" 
          value="$78.50" 
          change={4.3} 
          timeframe="last month" 
          icon={<ChartPieIconComponent className="h-6 w-6 text-purple-600" />} 
        />
        <StatCard 
          title="Conversion Rate" 
          value="3.2%" 
          change={-1.8} 
          timeframe="last month" 
          icon={<ChartBarIconComponent className="h-6 w-6 text-green-600" />} 
        />
        <StatCard 
          title="Active Users" 
          value="1,429" 
          change={12.5} 
          timeframe="last month" 
          icon={<ChartPieIconComponent className="h-6 w-6 text-yellow-600" />} 
        />
      </div>

      {/* Sales by Category Chart */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Sales by Category</h2>
        <div className="h-80 flex items-end justify-between">
          {/* Simulated bar chart */}
          <div className="flex-1 flex items-end justify-around">
            <div className="flex flex-col items-center">
              <div className="bg-blue-500 w-16 rounded-t-md" style={{ height: '65%' }}></div>
              <p className="mt-2 text-sm text-gray-600">Food</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-green-500 w-16 rounded-t-md" style={{ height: '40%' }}></div>
              <p className="mt-2 text-sm text-gray-600">Toys</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-yellow-500 w-16 rounded-t-md" style={{ height: '85%' }}></div>
              <p className="mt-2 text-sm text-gray-600">Accessories</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-purple-500 w-16 rounded-t-md" style={{ height: '55%' }}></div>
              <p className="mt-2 text-sm text-gray-600">Health</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-red-500 w-16 rounded-t-md" style={{ height: '30%' }}></div>
              <p className="mt-2 text-sm text-gray-600">Travel</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Revenue</h2>
          <div className="h-60 flex items-end justify-between">
            {/* Simulated line chart */}
            <div className="flex-1 flex items-end justify-around relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="absolute inset-0 flex items-center" style={{ top: '25%' }}>
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="absolute inset-0 flex items-center" style={{ top: '50%' }}>
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="absolute inset-0 flex items-center" style={{ top: '75%' }}>
                <div className="w-full border-t border-gray-200"></div>
              </div>
              
              <div className="relative w-full h-full">
                <svg className="w-full h-full" viewBox="0 0 100 60" preserveAspectRatio="none">
                  <path 
                    d="M0,60 L10,50 L20,55 L30,40 L40,45 L50,30 L60,35 L70,25 L80,15 L90,20 L100,10" 
                    fill="none" 
                    stroke="#3B82F6" 
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-4 text-sm text-gray-600">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Traffic Sources</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Direct</span>
                <span className="text-sm font-medium text-gray-700">45%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Social Media</span>
                <span className="text-sm font-medium text-gray-700">30%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '30%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Search</span>
                <span className="text-sm font-medium text-gray-700">15%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '15%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Referral</span>
                <span className="text-sm font-medium text-gray-700">10%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '10%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats; 
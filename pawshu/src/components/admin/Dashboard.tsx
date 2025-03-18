import React from 'react';

const Dashboard = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Total Products</h2>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">Loading...</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Total Users</h2>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">Loading...</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Total Donations</h2>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">Loading...</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
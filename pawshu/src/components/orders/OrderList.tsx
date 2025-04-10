import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Link } from 'react-router-dom';

interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

// Helper function to get user's full name from various data formats
const getUserFullName = (user: any): string => {
  if (!user) return 'Unknown User';
  
  // If user is a string, it's likely just an ID reference
  if (typeof user === 'string') return 'Unknown User';
  
  // If name is available as a virtual property
  if (user.name && typeof user.name === 'string' && user.name.trim() !== '') {
    return user.name;
  }
  
  // If firstName and lastName are available
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  
  // Fall back to email if available
  if (user.email) {
    return user.email.split('@')[0]; // Use the part before @ as a fallback name
  }
  
  return 'Unknown User';
};

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders');
      setOrders(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || 'Failed to load your orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300';
      case 'pending':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
      case 'shipped':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300';
      case 'delivered':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredOrders = activeFilter === 'all' 
    ? orders 
    : orders.filter(order => order.status === activeFilter);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No orders yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't placed any orders yet.</p>
        <Link to="/products" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-full text-sm ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveFilter('pending')}
          className={`px-4 py-2 rounded-full text-sm ${
            activeFilter === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setActiveFilter('processing')}
          className={`px-4 py-2 rounded-full text-sm ${
            activeFilter === 'processing'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Processing
        </button>
        <button
          onClick={() => setActiveFilter('shipped')}
          className={`px-4 py-2 rounded-full text-sm ${
            activeFilter === 'shipped'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Shipped
        </button>
        <button
          onClick={() => setActiveFilter('delivered')}
          className={`px-4 py-2 rounded-full text-sm ${
            activeFilter === 'delivered'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Delivered
        </button>
        <button
          onClick={() => setActiveFilter('cancelled')}
          className={`px-4 py-2 rounded-full text-sm ${
            activeFilter === 'cancelled'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Cancelled
        </button>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div key={order._id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Order #{order._id.slice(-8)}
                  </h3>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                    Payment: {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Placed on {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="mt-2 md:mt-0">
                <Link 
                  to={`/order/${order._id}`} 
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  View Details
                </Link>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {order.items.slice(0, 2).map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white font-medium">{item.productName}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-900 dark:text-white font-medium">NPR {item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {order.items.length > 2 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  + {order.items.length - 2} more items
                </p>
              )}
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <span className="font-medium text-gray-900 dark:text-white">Total</span>
                <span className="font-bold text-gray-900 dark:text-white">NPR {order.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {(order.status === 'delivered') && (
              <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <button
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  Write Review
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderList; 
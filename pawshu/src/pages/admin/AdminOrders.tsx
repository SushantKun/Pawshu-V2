import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';

interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string;
}

interface Order {
  _id: string;
  userId: string;
  userName: string;
  user?: any; // Object containing user details from populated userId field
  items: OrderItem[];
  totalAmount: number;
  shippingAddress: ShippingAddress;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
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

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    // Filter and sort orders whenever the order list, filter, search, or sort options change
    let result = [...orders];

    // Apply filter
    if (filter !== 'all') {
      result = result.filter(order => order.status === filter);
    }

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(order => 
        order._id.toLowerCase().includes(searchLower) ||
        order.userName.toLowerCase().includes(searchLower) || 
        order.shippingAddress?.phone?.includes(search)
      );
    }

    // Apply sorting
    result.sort((a: any, b: any) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle dates
      if (sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredOrders(result);
  }, [orders, filter, search, sortField, sortOrder]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/orders');
      setOrders(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      
      // Update the orders list
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId 
            ? { ...order, status: newStatus as any } 
            : order
        )
      );
      
      // Close modal if open
      if (selectedOrder?._id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus as any });
      }
      
      toast.success(`Order status updated to ${newStatus}`);
    } catch (err: any) {
      console.error('Error updating order status:', err);
      toast.error(err.response?.data?.message || 'Failed to update order status');
    }
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `NPR ${amount.toFixed(2)}`;
  };

  const OrderDetailsModal = () => {
    if (!selectedOrder) return null;

    return (
      <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center ${isModalOpen ? '' : 'hidden'}`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Order Details</h2>
            <button 
              onClick={closeModal}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Order Information</h3>
                <p className="text-gray-900 dark:text-white mb-1">
                  <span className="font-medium">Order ID:</span> {selectedOrder._id}
                </p>
                <p className="text-gray-900 dark:text-white mb-1">
                  <span className="font-medium">Date:</span> {formatDate(selectedOrder.createdAt)}
                </p>
                <p className="text-gray-900 dark:text-white mb-1">
                  <span className="font-medium">Customer:</span> {getUserFullName(selectedOrder.user || { firstName: selectedOrder.shippingAddress.firstName, lastName: selectedOrder.shippingAddress.lastName })}
                </p>
                <p className="text-gray-900 dark:text-white mb-1">
                  <span className="font-medium">Total Amount:</span> {formatCurrency(selectedOrder.totalAmount)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(selectedOrder.paymentStatus)}`}>
                    {selectedOrder.paymentStatus.charAt(0).toUpperCase() + selectedOrder.paymentStatus.slice(1)}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Shipping Address</h3>
                <p className="text-gray-900 dark:text-white">
                  {selectedOrder.shippingAddress.firstName} {selectedOrder.shippingAddress.lastName}
                </p>
                <p className="text-gray-900 dark:text-white">
                  {selectedOrder.shippingAddress.address}
                </p>
                <p className="text-gray-900 dark:text-white">
                  {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}
                </p>
                <p className="text-gray-900 dark:text-white">
                  Phone: {selectedOrder.shippingAddress.phone}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Order Items</h3>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-100 dark:bg-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                    {selectedOrder.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.productName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                          {formatCurrency(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                        Total
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(selectedOrder.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Update Order Status</h3>
              <div className="flex flex-wrap gap-2">
                {selectedOrder.status !== 'pending' && (
                  <button 
                    onClick={() => handleStatusChange(selectedOrder._id, 'pending')}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Pending
                  </button>
                )}
                {selectedOrder.status !== 'processing' && (
                  <button 
                    onClick={() => handleStatusChange(selectedOrder._id, 'processing')}
                    className="px-4 py-2 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-md text-sm font-medium hover:bg-yellow-200 dark:hover:bg-yellow-700"
                  >
                    Processing
                  </button>
                )}
                {selectedOrder.status !== 'shipped' && (
                  <button 
                    onClick={() => handleStatusChange(selectedOrder._id, 'shipped')}
                    className="px-4 py-2 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-md text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-700"
                  >
                    Shipped
                  </button>
                )}
                {selectedOrder.status !== 'delivered' && (
                  <button 
                    onClick={() => handleStatusChange(selectedOrder._id, 'delivered')}
                    className="px-4 py-2 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-md text-sm font-medium hover:bg-green-200 dark:hover:bg-green-700"
                  >
                    Delivered
                  </button>
                )}
                {selectedOrder.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleStatusChange(selectedOrder._id, 'cancelled')}
                    className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 rounded-md text-sm font-medium hover:bg-red-200 dark:hover:bg-red-700"
                  >
                    Cancelled
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Orders</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A list of all orders in your store including customer name, order status, and total amount.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">Search Orders</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              name="search"
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              placeholder="Search orders by ID, customer name, or phone number"
            />
          </div>
        </div>

        <div className="sm:w-64">
          <label htmlFor="filter" className="sr-only">Filter by Status</label>
          <select
            id="filter"
            name="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="sm:w-64">
          <label htmlFor="sort" className="sr-only">Sort By</label>
          <select
            id="sort"
            name="sort"
            value={`${sortField}:${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split(':');
              setSortField(field);
              setSortOrder(order);
            }}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="createdAt:desc">Date (Newest First)</option>
            <option value="createdAt:asc">Date (Oldest First)</option>
            <option value="totalAmount:desc">Amount (High to Low)</option>
            <option value="totalAmount:asc">Amount (Low to High)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No orders found</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {search ? 'Try adjusting your search or filter parameters.' : 'Once customers start placing orders, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="overflow-x-auto rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Payment
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOrders.map((order) => (
                  <tr 
                    key={order._id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => openOrderDetails(order)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      #{order._id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {getUserFullName(order.user || { firstName: order.shippingAddress.firstName, lastName: order.shippingAddress.lastName })}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {order.shippingAddress.email || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrderDetails(order);
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal />
    </div>
  );
};

export default AdminOrders; 
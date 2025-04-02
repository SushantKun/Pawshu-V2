import React from 'react';

interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

interface OrderProps {
  order: {
    _id: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    items: OrderItem[];
    createdAt: string;
  };
}

const OrderSummary: React.FC<OrderProps> = ({ order }) => {
  // Format date
  const orderDate = new Date(order.createdAt).toLocaleDateString();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Order Summary</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Order ID:</p>
          <p className="text-gray-900 dark:text-white">
            {order._id.length > 12 ? `${order._id.substring(0, 12)}...` : order._id}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Date:</p>
          <p className="text-gray-900 dark:text-white">{orderDate}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Status:</p>
          <p className="text-gray-900 dark:text-white">{order.status}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Payment Status:</p>
          <p className="text-gray-900 dark:text-white">{order.paymentStatus}</p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Items</h3>
        
        <div className="space-y-4">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-300">{item.productName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Quantity: {item.quantity}</p>
              </div>
              <p className="font-medium text-gray-800 dark:text-gray-300">NPR {(item.price * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
          <div className="flex justify-between">
            <p className="font-semibold text-gray-900 dark:text-white">Total</p>
            <p className="font-semibold text-gray-900 dark:text-white">NPR {order.totalAmount.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary; 
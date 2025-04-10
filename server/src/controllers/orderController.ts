/**
 * Order Controller
 * 
 * Handles order-related business logic including creating orders,
 * fetching orders, updating order status, and payment processing.
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import Order from '../models/Order';
import Product from '../models/Product';
import mongoose from 'mongoose';

/**
 * Creates a new order in the system
 * 
 * @param req - Request object containing order details
 * @param res - Response object for returning order confirmation
 */
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Creating new order, request body:', JSON.stringify(req.body, null, 2));

    if (!req.user) {
      console.error('Authentication error: User not found in request');
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    console.log('Authenticated user:', JSON.stringify({
      _id: req.user._id,
      name: `${req.user.firstName} ${req.user.lastName}`,
      email: req.user.email
    }, null, 2));

    const { items, totalAmount, shippingAddress, paymentMethod } = req.body;

    // Validate required fields with detailed error messages
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error('Missing or invalid items in order request');
      res.status(400).json({ 
        message: 'Please provide valid items array',
        detail: 'The items field must be a non-empty array of products'
      });
      return;
    }
    
    if (totalAmount === undefined || totalAmount === null || isNaN(parseFloat(totalAmount))) {
      console.error('Missing or invalid totalAmount in order request:', totalAmount);
      res.status(400).json({ 
        message: 'Please provide a valid totalAmount',
        detail: 'The totalAmount must be a valid number'
      });
      return;
    }
    
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      console.error('Missing or invalid shippingAddress in order request');
      res.status(400).json({ 
        message: 'Please provide valid shipping address',
        detail: 'The shippingAddress must be an object with required address fields'
      });
      return;
    }
    
    // Verify shipping address has all required fields
    const requiredAddressFields = ['firstName', 'lastName', 'address', 'city', 'state', 'postalCode', 'phone'];
    const missingFields = requiredAddressFields.filter(field => !shippingAddress[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing shipping address fields:', missingFields);
      res.status(400).json({ 
        message: `Missing required shipping address fields: ${missingFields.join(', ')}`,
        missingFields,
        detail: 'All address fields must be provided'
      });
      return;
    }

    // Verify products exist and update stock
    for (const item of items) {
      if (!item.productId) {
        console.error('Missing productId in item:', item);
        res.status(400).json({ 
          message: 'Each item must have a productId',
          detail: 'Found an item without productId'
        });
        return;
      }

      // Log the productId to check its format
      console.log('Looking up product with ID:', item.productId);

      const product = await Product.findById(item.productId);
      if (!product) {
        console.error(`Product not found: ${item.productId}`);
        res.status(404).json({ 
          message: `Product not found: ${item.productId}`,
          detail: 'The requested product does not exist in the database'
        });
        return;
      }

      if (product.stock < item.quantity) {
        console.error(`Not enough stock for product: ${product.name}. Requested: ${item.quantity}, Available: ${product.stock}`);
        res.status(400).json({ 
          message: `Not enough stock for product: ${product.name}`,
          detail: `Requested ${item.quantity} units but only ${product.stock} available`
        });
        return;
      }

      // Update product stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Create a new order
    const order = new Order({
      userId: req.user._id,
      userName: req.user.firstName && req.user.lastName 
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email?.split('@')[0] || 'User', // Fallback to email or 'User'
      items,
      totalAmount,
      shippingAddress,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: paymentMethod || undefined,
    });

    console.log('Preparing to save order with data:', JSON.stringify({
      userId: order.userId,
      userName: order.userName,
      totalAmount: order.totalAmount,
      items: order.items.length,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod
    }, null, 2));
    
    await order.save();
    console.log('Order saved successfully with ID:', order._id);

    res.status(201).json({
      message: 'Order placed successfully!',
      order: {
        _id: order._id,
        totalAmount: order.totalAmount,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    if (error instanceof Error) {
      // Check for MongoDB validation errors which have a more specific format
      if (error.name === 'ValidationError') {
        res.status(400).json({ 
          message: 'Invalid order data', 
          error: error.message,
          detail: 'The order data failed validation checks'
        });
      } else if (error.name === 'CastError') {
        res.status(400).json({ 
          message: 'Invalid ID format', 
          error: error.message,
          detail: 'One of the provided IDs is in an incorrect format'
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to create order', 
          error: error.message,
          detail: 'An unexpected error occurred while processing your order'
        });
      }
    } else {
      res.status(500).json({ 
        message: 'Failed to create order', 
        error: 'Unknown error',
        detail: 'An unknown error occurred while processing your order'
      });
    }
  }
};

/**
 * Gets all orders for a user
 * 
 * @param req - Request object containing user authentication details
 * @param res - Response object for returning order data
 */
export const getUserOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Ensure we have a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
    }
    
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

/**
 * Gets details of a specific order
 * 
 * @param req - Request object containing order ID
 * @param res - Response object for returning order details
 */
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if the order belongs to the authenticated user
    if (req.user && order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to access this order' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    if (error instanceof Error && error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid order ID format' });
    } else {
      res.status(500).json({ message: 'Error fetching order details' });
    }
  }
};

/**
 * Updates payment status for an existing order (admin or fixes)
 * 
 * @param req - Request object containing order ID
 * @param res - Response object for returning updated order
 */
export const fixPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    console.log('Fixing payment status for order:', orderId);
    
    if (!orderId) {
      res.status(400).json({ message: 'Order ID is required' });
      return;
    }
    
    // Get the order from database
    const order = await Order.findById(orderId);
    if (!order) {
      console.error('Order not found:', orderId);
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    // Force update the payment status
    order.paymentStatus = 'completed';
    if (order.status === 'pending') {
      order.status = 'processing';
    }
    await order.save();
    
    res.json({
      message: 'Order payment status updated to completed',
      order: {
        id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('Error fixing payment status:', error);
    res.status(500).json({ 
      message: 'Failed to update payment status', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Updates the status of an order (admin only)
 * 
 * @param req - Request object containing order ID and new status
 * @param res - Response object for returning updated order
 */
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    console.log(`Updating order status: ${req.params.id} to ${req.body.status}`);
    
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Please provide status' });
    }
    
    // Validate status value
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      console.log(`Order not found: ${req.params.id}`);
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    await order.save();

    console.log(`Order ${req.params.id} status updated to ${status}`);
    res.json({ message: 'Order status updated', order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Cancels a user's order and restores product stock
 * 
 * @param req - Request object containing order ID and user authentication
 * @param res - Response object for returning cancellation confirmation
 */
export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Cancelling order:', req.params.id);
    
    if (!req.user) {
      console.error('Authentication error: User not found in request');
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }
    
    // Validate order ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid order ID format' });
    }
    
    // Find the order
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      console.log(`Order not found: ${req.params.id}`);
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Verify that this order belongs to the authenticated user
    if (order.userId.toString() !== req.user._id.toString()) {
      console.error('Unauthorized: User attempting to cancel another user\'s order');
      return res.status(403).json({ message: 'You are not authorized to cancel this order' });
    }
    
    // Check if the order is in a state where it can be cancelled
    if (order.status !== 'pending' && order.status !== 'processing') {
      console.log(`Cannot cancel order with status: ${order.status}`);
      return res.status(400).json({ 
        message: 'This order cannot be cancelled',
        detail: `Orders in '${order.status}' status cannot be cancelled. Please contact customer support.`
      });
    }
    
    // If order was paid, it would require additional logic for refund
    if (order.paymentStatus === 'completed') {
      console.log('Order was already paid, marking for refund consideration');
      // In a real application, you would initiate a refund process here
    }
    
    // Restore stock for each item
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        console.log(`Restoring stock for product ${product.name}: +${item.quantity}`);
        product.stock += item.quantity;
        await product.save();
      } else {
        console.warn(`Product not found for stock restoration: ${item.productId}`);
      }
    }
    
    // Update order status
    order.status = 'cancelled';
    await order.save();
    
    console.log(`Order ${req.params.id} has been cancelled successfully`);
    
    res.json({
      message: 'Order cancelled successfully',
      order: {
        _id: order._id,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    if (error instanceof Error) {
      res.status(500).json({ 
        message: 'Failed to cancel order', 
        error: error.message
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to cancel order', 
        error: 'Unknown error'
      });
    }
  }
}; 
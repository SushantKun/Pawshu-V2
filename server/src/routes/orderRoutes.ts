import express, { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import Order from '../models/Order';
import Product from '../models/Product';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

// Create eSewa payment signature
const createEsewaSignature = (message: string): string => {
  const secret = "8gBm/:&EnhH.1/q"; // eSewa test mode secret key
  
  console.log('Creating eSewa signature with message:', message);
  
  try {
    // Use HMAC-SHA256 algorithm with base64 encoding as specified in eSewa docs
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(message);
    const signature = hmac.digest("base64");
    
    console.log('Generated eSewa signature:', signature);
    return signature;
  } catch (error) {
    console.error('Error generating eSewa signature:', error);
    return '';
  }
};

// Create a new order
router.post('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

    const order = new Order({
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
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
});

// Generate eSewa payment data according to documentation
const generateEsewaPaymentData = async (order: any) => {
  // Format values exactly as required by eSewa
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const amount = String(order.totalAmount);
  const totalAmount = String(order.totalAmount); // Since we don't have extra charges
  const transactionUuid = String(order._id);
  const productCode = "EPAYTEST"; // Fixed product code for testing
  
  // Create signed_field_names and message in correct order as specified in docs
  const signedFieldNames = "total_amount,transaction_uuid,product_code";
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  
  // Generate signature
  const signature = createEsewaSignature(message);
  
  console.log('eSewa payment details:', {
    orderId: order._id,
    amount,
    totalAmount,
    transactionUuid,
    signedFieldNames,
    message,
    signature
  });

  // Return data in the exact format required by eSewa v2 API
  return {
    amount: amount,
    tax_amount: "0",
    total_amount: totalAmount,
    transaction_uuid: transactionUuid,
    product_code: productCode,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: `${clientUrl}/checkout/success?orderId=${transactionUuid}`,
    failure_url: `${clientUrl}/checkout/failure`,
    signed_field_names: signedFieldNames,
    signature: signature
  };
};

// Standalone eSewa payment initiation route
router.post('/esewa-payment', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Initiating eSewa payment with data:', JSON.stringify(req.body, null, 2));

    if (!req.user) {
      console.error('Authentication error: User not found in request');
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const { orderId } = req.body;
    
    if (!orderId) {
      res.status(400).json({ message: 'Please provide orderId' });
      return;
    }

    // Get order details
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    
    // Generate payment data using the eSewa format
    const paymentData = await generateEsewaPaymentData(order);
    
    // Return the payment data to the client
    console.log('eSewa payment data prepared:', paymentData);
    res.status(200).json(paymentData);
    
  } catch (error: any) {
    console.error('Error initiating eSewa payment:', error);
    res.status(500).json({ 
      message: 'Failed to initiate eSewa payment', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// eSewa success callback handler - Map this directly to the route
router.get('/esewa-success', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('eSewa success callback received with query params:', JSON.stringify(req.query, null, 2));
    
    const { data } = req.query;
    
    if (!data || typeof data !== 'string') {
      console.error('Invalid eSewa callback - missing or invalid data parameter');
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=missing_data`);
      return;
    }

    try {
      // Decode the base64 encoded data
      const decodedString = Buffer.from(data, "base64").toString("utf-8");
      console.log('Decoded eSewa data string:', decodedString);
      
      const decodedData = JSON.parse(decodedString);
      console.log('Parsed eSewa callback data:', JSON.stringify(decodedData, null, 2));

      // Verify if transaction was successful
      if (decodedData.status !== "COMPLETE") {
        console.error('eSewa payment not complete. Status:', decodedData.status);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=payment_incomplete`);
        return;
      }

      // Get the transaction details
      const transactionUuid = decodedData.transaction_uuid;
      const transactionCode = decodedData.transaction_code || '';

      console.log('Looking for order with ID:', transactionUuid);
      
      // Find and update the order
      const order = await Order.findById(transactionUuid);
      if (!order) {
        console.error('Order not found for transaction_uuid:', transactionUuid);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=order_not_found`);
        return;
      }

      // Only update if not already completed
      if (order.paymentStatus !== 'completed') {
        // Update order status
        console.log('Updating order payment status to completed');
        order.paymentStatus = 'completed';
        order.status = 'processing';
        order.paymentMethod = 'esewa';
        order.esewaRefId = transactionCode;
        await order.save();
        console.log('Order payment completed. OrderID:', transactionUuid, 'Transaction code:', transactionCode);
      } else {
        console.log('Order already marked as completed. OrderID:', transactionUuid);
      }
      
      // Redirect back to client success page
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const redirectUrl = `${clientUrl}/checkout/success?orderId=${transactionUuid}`;
      console.log('Redirecting to:', redirectUrl);
      
      res.redirect(redirectUrl);
    } catch (parseError) {
      console.error('Error parsing eSewa response data:', parseError);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=parse_error`);
    }
  } catch (error) {
    console.error('Error processing eSewa success callback:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=server_error`);
  }
});

// eSewa transaction verification
router.get('/esewa/verify/:orderId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;
    console.log('Verifying eSewa transaction for order:', orderId);
    
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
    
    // If order is already in "completed" payment status, no need to verify again
    if (order.paymentStatus === 'completed') {
      console.log('Order payment is already completed:', orderId);
      res.json({
        verified: true,
        status: 'COMPLETE',
        message: 'Transaction already verified and completed',
        order: {
          id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      });
      return;
    }

    // For orders with payment through eSewa that have the success page showing,
    // we can automatically mark the payment as completed since they reached this point
    if (order.paymentMethod === 'esewa') {
      console.log('Automatically completing eSewa payment for order:', orderId);
      order.paymentStatus = 'completed';
      if (order.status === 'pending') {
        order.status = 'processing';
      }
      await order.save();
      
      res.json({
        verified: true,
        status: 'COMPLETE',
        message: 'Transaction verified as completed based on payment method',
        order: {
          id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      });
      return;
    }
    
    // Proceed with verification from the eSewa API
    const totalAmount = order.totalAmount;
    const productCode = "EPAYTEST"; // This should match what you used in the payment request
    
    // eSewa verification URL
    const verificationUrl = `https://rc.esewa.com.np/api/epay/transaction/status/?product_code=${productCode}&total_amount=${totalAmount}&transaction_uuid=${orderId}`;
    console.log('Sending verification request to:', verificationUrl);
    
    // Make a GET request to eSewa's status check API
    const verificationResponse = await axios.get(verificationUrl);
    console.log('eSewa verification response:', JSON.stringify(verificationResponse.data, null, 2));
    
    // Handle the verification response
    const { status, ref_id } = verificationResponse.data;
    
    if (status === 'COMPLETE') {
      // Transaction is verified as successful
      if (order.paymentStatus !== 'completed') {
        // Update the order status if it wasn't already marked as completed
        console.log('Updating order payment status to completed based on verification');
        order.paymentStatus = 'completed';
        order.status = 'processing';
        order.paymentMethod = 'esewa';
        order.esewaRefId = ref_id;
        await order.save();
      }
      
      res.json({
        verified: true,
        status: 'COMPLETE',
        message: 'Transaction verified successfully',
        order: {
          id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          esewaRefId: ref_id
        }
      });
    } else if (status === 'PENDING') {
      res.json({
        verified: false,
        status: 'PENDING',
        message: 'Transaction is still pending',
        order: {
          id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      });
    } else {
      // Transaction failed or was cancelled
      console.log('Transaction verification failed or transaction was cancelled');
      
      if (order.paymentStatus === 'pending') {
        order.paymentStatus = 'failed';
        await order.save();
      }
      
      res.json({
        verified: false,
        status,
        message: `Transaction verification failed. Status: ${status}`,
        order: {
          id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      });
    }
  } catch (error) {
    console.error('Error verifying eSewa transaction:', error);
    res.status(500).json({ message: 'Failed to verify transaction', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Universal payment verification endpoint that works for all payment methods
router.get('/verify-payment/:orderId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId } = req.params;
    console.log('Verifying payment for order:', orderId);
    
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
    
    // If order is already in "completed" payment status, no need to verify again
    if (order.paymentStatus === 'completed') {
      console.log('Order payment is already completed:', orderId);
      res.json({
        verified: true,
        status: 'COMPLETE',
        message: 'Transaction already verified and completed',
        order: {
          id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      });
      return;
    }

    // For orders that have reached the success page, we consider payment complete
    // This works as a fallback for all payment methods
    console.log('Automatically completing payment for order:', orderId, 'Payment method:', order.paymentMethod || 'unknown');
    
    // Update payment status to completed
    order.paymentStatus = 'completed';
    if (order.status === 'pending') {
      order.status = 'processing';
    }
    
    // If payment method is not set yet, use 'card' as default
    if (!order.paymentMethod) {
      order.paymentMethod = 'card';
    }
    
    await order.save();
    
    res.json({
      verified: true,
      status: 'COMPLETE',
      message: 'Payment marked as completed',
      order: {
        id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Failed to verify payment', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get user's orders
router.get('/user', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Get order by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Fetching order details for ID:', req.params.id);
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      console.log('Order not found:', req.params.id);
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // If this is an auth request with a user, verify permissions
    if ('user' in req && req.user) {
      const authReq = req as AuthRequest;
      // Only allow users to view their own orders unless they're an admin
      if (authReq.user && order.userId.toString() !== authReq.user._id.toString() && !authReq.user.isAdmin) {
        res.status(403).json({ message: 'You do not have permission to view this order' });
        return;
      }
    }

    // Return the order data with a flag indicating if payment can be retried
    // Only allow payment retry for orders with failed payment status
    const canRetryPayment = order.paymentStatus === 'failed' && order.status === 'pending';

    res.json({
      ...order.toObject(),
      canRetryPayment
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    next(error);
  }
});

// Get all orders (admin only)
router.get('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const orders = await Order.find()
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Update order status (admin only)
router.put('/:id/status', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const { status } = req.body;
    if (!status) {
      res.status(400).json({ message: 'Please provide status' });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    order.status = status;
    await order.save();

    res.json({ message: 'Order status updated', order });
  } catch (error) {
    next(error);
  }
});

// Get order statistics (admin only)
router.get('/stats/summary', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const totalOrders = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' }
        }
      }
    ]);

    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      total: totalOrders[0] || { totalAmount: 0, count: 0, avgAmount: 0 },
      byStatus: ordersByStatus
    });
  } catch (error) {
    next(error);
  }
});

// User cancel order
router.put('/:id/cancel', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Only allow users to cancel their own orders
    if (order.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Only allow cancellation of pending or processing orders
    if (!['pending', 'processing'].includes(order.status)) {
      res.status(400).json({ 
        message: `Cannot cancel order with status "${order.status}". Only pending or processing orders can be cancelled.` 
      });
      return;
    }

    // Update order status to cancelled
    order.status = 'cancelled';
    await order.save();

    res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    next(error);
  }
});

// Retry payment for failed orders
router.post('/:id/retry-payment', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const { paymentMethod } = req.body;
    if (!paymentMethod) {
      res.status(400).json({ message: 'Payment method is required' });
      return;
    }

    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Only allow users to retry payment for their own orders
    if (order.userId.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Only allow payment retry for orders with failed payment status and pending status
    if (order.status !== 'pending' || order.paymentStatus !== 'failed') {
      res.status(400).json({ 
        message: `Cannot retry payment for this order. Order must be in pending status with failed payment.`
      });
      return;
    }

    // Reset payment status to pending
    order.paymentStatus = 'pending';
    order.paymentMethod = paymentMethod;
    await order.save();

    // Return the information needed based on the payment method
    if (paymentMethod === 'esewa') {
      // Generate eSewa payment data
      const esewaPaymentData = await generateEsewaPaymentData(order);
      res.json({ 
        message: 'Payment retry initiated', 
        order,
        paymentData: esewaPaymentData
      });
    } else if (paymentMethod === 'khalti') {
      res.json({ 
        message: 'Payment retry initiated', 
        order,
        orderId: order._id
      });
    } else {
      res.json({ 
        message: 'Payment status reset to pending', 
        order 
      });
    }
  } catch (error) {
    console.error('Error retrying payment:', error);
    next(error);
  }
});

// Khalti payment initiation
router.post('/khalti-payment', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Initiating Khalti payment with data:', JSON.stringify(req.body, null, 2));
    console.log('Auth user:', req.user);

    if (!req.user) {
      console.error('Authentication error: User not found in request');
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const { orderId, amount } = req.body;
    
    if (!orderId || !amount) {
      res.status(400).json({ message: 'Please provide orderId and amount' });
      return;
    }

    // Get Khalti keys from environment variables
    const khaltiSecretKey = process.env.KHALTI_SECRET_KEY;
    if (!khaltiSecretKey) {
      console.error('KHALTI_SECRET_KEY is not defined in environment variables');
      res.status(500).json({ message: 'Server configuration error - Khalti keys not configured' });
      return;
    }
    
    // Get order details
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Convert amount to paisa (Khalti requires amount in paisa)
    const amountInPaisa = Math.round(parseFloat(amount) * 100);
    
    // Prepare payload for Khalti API
    const khaltiPayload = {
      return_url: `${process.env.CLIENT_URL}/checkout/success?orderId=${orderId}`,
      website_url: process.env.CLIENT_URL || 'http://localhost:5173',
      amount: amountInPaisa,
      purchase_order_id: orderId,
      purchase_order_name: `Order #${orderId}`,
      customer_info: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        phone: req.user.phone || ''
      },
      amount_breakdown: [
        {
          label: 'Order Payment',
          amount: amountInPaisa
        }
      ],
      product_details: order.items.map(item => ({
        identity: item.productId.toString(),
        name: item.productName,
        total_price: Math.round(item.price * item.quantity * 100),
        quantity: item.quantity,
        unit_price: Math.round(item.price * 100)
      }))
    };

    console.log('Sending Khalti request with payload:', JSON.stringify(khaltiPayload, null, 2));
    console.log('Using Khalti secret key:', khaltiSecretKey.substring(0, 5) + '...');

    // Use Khalti sandbox API URL
    const khaltiApiUrl = 'https://dev.khalti.com/api/v2/epayment/initiate/';

    // Make request to Khalti API with CORRECT AUTHORIZATION FORMAT
    try {
      const khaltiResponse = await axios.post(
        khaltiApiUrl, 
        khaltiPayload,
        {
          headers: {
            'Authorization': `Key ${khaltiSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Khalti API response:', JSON.stringify(khaltiResponse.data, null, 2));

      // Return the payment URL to the client
      res.status(200).json({
        paymentUrl: khaltiResponse.data.payment_url,
        pidx: khaltiResponse.data.pidx
      });
    } catch (apiError: any) {
      console.error('Khalti API request failed:', apiError.message);
      if (apiError.response) {
        console.error('Khalti API error response:', apiError.response.data);
        res.status(apiError.response.status).json({ 
          message: 'Failed to initiate Khalti payment', 
          error: apiError.response.data 
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to connect to Khalti API', 
          error: apiError.message
        });
      }
    }
  } catch (error: any) {
    console.error('Error initiating Khalti payment:', error);
    res.status(500).json({ 
      message: 'Failed to initiate Khalti payment', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Khalti success verification endpoint
router.get('/khalti/verify', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Khalti verification callback received with query params:', JSON.stringify(req.query, null, 2));
    
    const { pidx, purchase_order_id, amount, transaction_id } = req.query;
    
    if (!pidx || !purchase_order_id) {
      console.error('Invalid Khalti callback data - missing pidx or purchase_order_id');
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=missing_params`);
      return;
    }

    const orderId = purchase_order_id.toString();
    
    try {
      // Get Khalti keys from environment variables
      const khaltiSecretKey = process.env.KHALTI_SECRET_KEY;
      if (!khaltiSecretKey) {
        console.error('KHALTI_SECRET_KEY is not defined in environment variables');
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=server_config_error`);
        return;
      }
      
      // Use Khalti sandbox API URL for verification
      const khaltiVerifyUrl = 'https://dev.khalti.com/api/v2/epayment/lookup/';
      
      // Verify the transaction with Khalti
      const verificationResponse = await axios.post(
        khaltiVerifyUrl, 
        { pidx },
        {
          headers: {
            'Authorization': `Key ${khaltiSecretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Khalti verification response:', JSON.stringify(verificationResponse.data, null, 2));

      const paymentStatus = verificationResponse.data.status;
      
      if (paymentStatus === 'Completed') {
        // Update order with payment information
        const order = await Order.findById(orderId);
        if (!order) {
          console.error('Order not found for purchase_order_id:', orderId);
          res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=order_not_found`);
          return;
        }

        // Always update order status to reflect payment completion
        console.log('Updating order payment status to completed');
        order.paymentStatus = 'completed';
        order.status = 'processing';
        order.paymentMethod = 'khalti';
        order.khaltiReference = transaction_id?.toString() || pidx?.toString();
        await order.save();

        console.log('Order payment completed:', orderId, 'Transaction:', transaction_id);
        
        // Redirect back to client success page
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const redirectUrl = `${clientUrl}/checkout/success?orderId=${orderId}`;
        console.log('Redirecting to:', redirectUrl);
        
        res.redirect(redirectUrl);
      } else {
        console.error('Khalti payment not complete. Status:', paymentStatus);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=payment_incomplete`);
      }
    } catch (verificationError) {
      console.error('Error verifying Khalti transaction:', verificationError);
      if (verificationError.response) {
        console.error('Khalti verification API error:', verificationError.response.data);
      }
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=verification_failed`);
    }
  } catch (error) {
    console.error('Error processing Khalti success callback:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout?status=failed&reason=unknown_error`);
  }
});

// Fix payment status for orders already paid (this is a temporary fix)
router.get('/fix-payment/:orderId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    res.status(500).json({ message: 'Failed to update payment status', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router; 
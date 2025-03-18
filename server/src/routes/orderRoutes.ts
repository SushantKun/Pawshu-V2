import express, { Request, Response, NextFunction } from 'express';
import { AuthRequest, verifyToken } from '../middleware/auth';
import Order from '../models/Order';
import Product from '../models/Product';

const router = express.Router();

// Create a new order
router.post('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Creating new order:', req.body);

    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const { items, totalAmount, shippingAddress } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0 || !totalAmount || !shippingAddress) {
      res.status(400).json({ message: 'Please provide all required fields: items, totalAmount, shippingAddress' });
      return;
    }

    // Verify products exist and update stock
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        res.status(404).json({ message: `Product not found: ${item.productId}` });
        return;
      }

      if (product.stock < item.quantity) {
        res.status(400).json({ message: `Not enough stock for product: ${product.name}` });
        return;
      }

      // Update product stock
      product.stock -= item.quantity;
      await product.save();
    }

    const order = new Order({
      userId: req.user._id,
      userName: req.user.name,
      items,
      totalAmount,
      shippingAddress,
      status: 'pending',
      paymentStatus: 'completed', // Assuming payment is completed at this point
    });

    console.log('Saving order:', order);
    await order.save();
    console.log('Order saved successfully:', order._id);

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
      res.status(500).json({ message: 'Failed to create order', error: error.message });
    } else {
      res.status(500).json({ message: 'Failed to create order', error: 'Unknown error' });
    }
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
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

    // Only allow users to view their own orders unless they're an admin
    if (order.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    res.json(order);
  } catch (error) {
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

export default router; 
/**
 * Order Routes
 * 
 * Defines API endpoints for order functionality including creating orders,
 * processing payments, and managing order status.
 */

import express, { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  fixPaymentStatus,
  cancelOrder
} from '../controllers/orderController';
import {
  initiateEsewaPayment,
  handleEsewaCallback,
  initiateKhaltiPayment,
  verifyKhaltiPayment,
  verifyPaymentStatus,
  updatePaymentStatus
} from '../controllers/paymentController';

const router: Router = express.Router();

// Order endpoints
router.post('/', verifyToken, createOrder);
router.get('/', verifyToken, getUserOrders);
router.get('/:orderId', verifyToken, getOrderById);
router.put('/:id/cancel', verifyToken, cancelOrder);

// Payment endpoints
router.post('/esewa-payment', verifyToken, initiateEsewaPayment);
router.get('/esewa/success', handleEsewaCallback);
router.get('/esewa/failure', handleEsewaCallback);
router.post('/khalti-payment', verifyToken, initiateKhaltiPayment);
router.get('/khalti/verify', verifyKhaltiPayment);
router.get('/verify-payment/:orderId', verifyPaymentStatus);
router.put('/payment/:orderId', verifyToken, updatePaymentStatus);
router.put('/fix-payment/:orderId', fixPaymentStatus);

export default router; 
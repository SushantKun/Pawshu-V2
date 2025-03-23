import { Request, Response } from 'express';
import Order from '../models/Order';
import axios from 'axios';
import { IOrder } from '../models/Order';

// Add Khalti payment handling
export const initiateKhaltiPayment = async (req: Request, res: Response) => {
  try {
    const { orderId, amount, customerInfo } = req.body;
    
    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Create a unique purchase order ID
    const purchaseOrderId = `Pawshu_${Date.now()}_${orderId}`;
    
    // Prepare the payload according to Khalti documentation
    const payload = {
      return_url: `${process.env.CLIENT_URL}/payment/khalti/success`,
      website_url: process.env.CLIENT_URL || 'http://localhost:5173',
      amount: Math.round(amount * 100), // Convert to paisa and ensure it's an integer
      purchase_order_id: purchaseOrderId,
      purchase_order_name: `Pawshu Order #${orderId}`,
      customer_info: customerInfo || {
        name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
        email: 'customer@example.com', // Default email since it's not in the order model
        phone: order.shippingAddress.phone
      },
      amount_breakdown: [
        {
          label: "Order Amount",
          amount: Math.round(amount * 100) // Ensure integer amount in paisa
        }
      ],
      product_details: order.items.map(item => ({
        identity: item.productId.toString(),
        name: item.productName,
        total_price: Math.round(item.price * item.quantity * 100), // Ensure integer
        quantity: item.quantity,
        unit_price: Math.round(item.price * 100) // Ensure integer
      }))
    };
    
    console.log('Initiating Khalti payment with payload:', JSON.stringify(payload, null, 2));
    
    // Make the request to Khalti's initiate endpoint
    const response = await axios.post(
      'https://dev.khalti.com/api/v2/epayment/initiate/',
      payload,
      {
        headers: {
          Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Khalti initiation response:', response.data);
    
    // Store the PIDX in the order for future verification
    order.khaltiPidx = response.data.pidx;
    order.paymentMethod = 'khalti';
    await order.save();
    
    // Return the payment URL and other information
    return res.json({
      success: true,
      orderId,
      pidx: response.data.pidx,
      payment_url: response.data.payment_url,
      expires_at: response.data.expires_at
    });
  } catch (error) {
    console.error('Error initiating Khalti payment:', error);
    
    // Extract and log the detailed error message from Khalti
    if (error.response && error.response.data) {
      console.error('Khalti error details:', JSON.stringify(error.response.data, null, 2));
    }
    
    return res.status(500).json({ 
      message: 'Failed to initiate Khalti payment', 
      error: error.message,
      details: error.response?.data || 'No detailed error information available'
    });
  }
};

export const verifyKhaltiPayment = async (req: Request, res: Response) => {
  try {
    const { pidx, status, transaction_id, purchase_order_id } = req.query;
    
    console.log('Verifying Khalti payment with:', { pidx, status, transaction_id, purchase_order_id });
    
    // If status is 'Completed', verify with Khalti's lookup API
    if (status === 'Completed') {
      try {
        // Look up the payment using Khalti's lookup endpoint
        const response = await axios.post(
          'https://dev.khalti.com/api/v2/epayment/lookup/',
          { pidx },
          {
            headers: {
              Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('Khalti lookup response:', response.data);
        
        if (response.data && response.data.status === 'Completed') {
          let order: IOrder | null = null;
          let orderId: string | undefined = undefined;
          
          // First try to find the order using pidx
          order = await Order.findOne({ khaltiPidx: pidx });
          console.log('Looking for order with pidx:', pidx);
          
          // If not found by pidx, try with purchase_order_id
          if (!order && purchase_order_id) {
            console.log('Order not found by pidx, trying purchase_order_id:', purchase_order_id);
            const purchaseOrderId = purchase_order_id as string;
            const parts = purchaseOrderId.split('_');
            
            if (parts.length > 2) {
              orderId = parts[parts.length - 1];
              console.log('Extracted order ID from purchase_order_id:', orderId);
              
              if (orderId) {
                order = await Order.findById(orderId);
                if (order) {
                  console.log('Found order by ID:', order._id);
                  // Save the pidx for future reference
                  order.khaltiPidx = pidx as string;
                }
              }
            }
          }
          
          if (!order) {
            console.error('Order not found for pidx:', pidx, 'or purchase_order_id:', purchase_order_id);
            return res.status(404).json({ 
              success: false,
              message: 'Order not found'
            });
          }
          
          // Update order with Khalti payment details
          order.paymentStatus = 'completed';
          order.paymentMethod = 'khalti';
          order.transactionId = transaction_id as string || response.data.transaction_id;
          order.status = 'processing';
          
          console.log('Updating order payment status for order:', order._id);
          
          try {
            await order.save();
            console.log('Order payment status updated to completed for order:', order._id);
          } catch (saveError) {
            console.error('Error saving order:', saveError);
            
            // Fallback: try with findByIdAndUpdate
            try {
              await Order.findByIdAndUpdate(
                order._id,
                { 
                  $set: { 
                    paymentStatus: 'completed',
                    paymentMethod: 'khalti',
                    status: 'processing',
                    transactionId: transaction_id as string || response.data.transaction_id,
                    khaltiPidx: pidx as string
                  } 
                }
              );
              console.log('Order updated with findByIdAndUpdate for order:', order._id);
            } catch (updateError) {
              console.error('Error updating order:', updateError);
              return res.status(500).json({ 
                success: false, 
                message: 'Failed to update order payment status' 
              });
            }
          }
          
          // Get the updated order
          const updatedOrder = await Order.findById(order._id);
          
          if (!updatedOrder) {
            return res.status(500).json({
              success: false,
              message: 'Failed to retrieve updated order'
            });
          }
          
          return res.json({
            success: true,
            message: 'Payment verified successfully',
            order: {
              id: updatedOrder._id,
              status: updatedOrder.status,
              paymentStatus: updatedOrder.paymentStatus
            }
          });
        } else {
          console.error('Khalti verification failed. Status:', response.data.status);
          return res.status(400).json({ 
            success: false, 
            message: 'Payment verification failed. Status: ' + response.data.status 
          });
        }
      } catch (lookupError) {
        console.error('Error calling Khalti lookup API:', lookupError);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to verify payment with Khalti',
          error: lookupError instanceof Error ? lookupError.message : 'Unknown error'
        });
      }
    } else {
      console.error('Payment not completed. Status:', status);
      return res.status(400).json({
        success: false,
        message: `Payment not completed. Status: ${status}`,
      });
    }
  } catch (error) {
    console.error('Error in Khalti payment verification:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to verify payment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 
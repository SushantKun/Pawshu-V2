import express, { Request, Response, NextFunction } from 'express';
import { AuthRequest, verifyToken } from '../middleware/auth';
import Donation from '../models/Donation';
import { Charity } from '../models/Charity';
import crypto from 'crypto';
import mongoose from 'mongoose';
import axios from 'axios';

const router = express.Router();

// Create eSewa payment signature
const createEsewaSignature = (message: string): string => {
  const secret = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q"; // Test mode secret key
  
  // Log the inputs for debugging
  console.log('Creating donation signature with:', { message, secret });
  
  // Use the correct HMAC algorithm and encoding
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  const signature = hmac.digest("base64");
  
  console.log('Generated donation signature:', signature);
  return signature;
};

// Create a new donation
router.post('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Creating new donation:', req.body);

    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    // Validate required fields
    const { charityId, charityName, amount, status = 'pending' } = req.body;
    if (!charityId || !charityName || !amount) {
      res.status(400).json({ message: 'Please provide all required fields: charityId, charityName, amount' });
      return;
    }

    // Verify charity exists
    const charity = await Charity.findById(charityId);
    if (!charity) {
      res.status(404).json({ message: 'Charity not found' });
      return;
    }

    const donation = new Donation({
      userId: req.user._id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      charityId,
      charityName,
      amount,
      status,
      date: new Date()
    });

    console.log('Saving donation:', donation);
    await donation.save();
    console.log('Donation saved successfully:', donation._id);

    // If status is 'completed', update charity progress now
    if (status === 'completed') {
      charity.raised += parseFloat(amount.toString());
      await charity.save();
    }

    res.status(201).json(donation);
  } catch (error) {
    console.error('Error creating donation:', error);
    if (error instanceof Error) {
      res.status(500).json({ message: 'Failed to create donation', error: error.message });
    } else {
      res.status(500).json({ message: 'Failed to create donation', error: 'Unknown error' });
    }
  }
});

// Complete a donation and update charity balance
router.put('/:id/complete', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const { id } = req.params;
    const { paymentMethod = 'card' } = req.body;

    // Find donation and verify ownership
    const donation = await Donation.findById(id);
    if (!donation) {
      res.status(404).json({ message: 'Donation not found' });
      return;
    }

    if (donation.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Check if donation is already completed
    if (donation.status === 'completed') {
      res.json(donation);
      return;
    }

    // Update donation status
    donation.status = 'completed';
    donation.paymentMethod = paymentMethod;
    await donation.save();

    // Update charity raised amount
    const charity = await Charity.findById(donation.charityId);
    if (charity) {
      charity.raised += donation.amount;
      await charity.save();
    }

    res.json(donation);
  } catch (error) {
    console.error('Error completing donation:', error);
    if (error instanceof Error) {
      res.status(500).json({ message: 'Failed to complete donation', error: error.message });
    } else {
      res.status(500).json({ message: 'Failed to complete donation', error: 'Unknown error' });
    }
  }
});

// eSewa payment initiation for donations
router.post('/esewa-payment', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Initiating eSewa donation payment with data:', JSON.stringify(req.body, null, 2));
    
    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    const { donationId, amount, charityId } = req.body;
    
    if (!donationId || !amount) {
      res.status(400).json({ message: 'Missing required fields: donationId, amount' });
      return;
    }

    // Verify the donation exists and belongs to this user
    const donation = await Donation.findById(donationId);
    if (!donation) {
      console.error('Donation not found:', donationId);
      res.status(404).json({ message: 'Donation not found' });
      return;
    }

    if (donation.userId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      console.error('Access denied: Donation does not belong to user');
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Server URL configuration
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';
    
    console.log('Using URLs:', { clientUrl, serverUrl });

    // Create eSewa payment request payload
    const signatureMessage = `total_amount=${amount},transaction_uuid=${donationId},product_code=EPAYTEST`;
    const signature = createEsewaSignature(signatureMessage);
    console.log('Donation payment request signature message:', signatureMessage);
    console.log('Donation payment request signature:', signature);

    const formData = {
      amount: amount,
      failure_url: `${clientUrl}/donate?status=failed`,
      product_delivery_charge: "0",
      product_service_charge: "0",
      product_code: "EPAYTEST",
      signature: signature,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      success_url: `${serverUrl}/api/donations/esewa/success`,
      tax_amount: "0",
      total_amount: amount,
      transaction_uuid: donationId,
    };

    console.log('Generated eSewa donation formData:', JSON.stringify(formData, null, 2));
    console.log('Expected callback URL:', `${serverUrl}/api/donations/esewa/success`);

    // Return the form data to be submitted client-side
    res.json({
      message: 'eSewa donation payment initiated',
      payment_method: 'esewa',
      formData
    });
  } catch (error) {
    console.error('Error initiating eSewa donation payment:', error);
    res.status(500).json({ message: 'Failed to initiate payment' });
  }
});

// eSewa success callback handler for donations
router.get('/esewa/success', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('eSewa donation success callback received with query params:', JSON.stringify(req.query, null, 2));
    
    const { data } = req.query;
    
    if (!data || typeof data !== 'string') {
      console.error('Invalid eSewa callback data - missing or invalid data parameter');
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/donate?status=failed&reason=missing_data`);
      return;
    }

    try {
      // Decode and parse the data
      const decodedString = Buffer.from(data, "base64").toString("utf-8");
      console.log('Decoded eSewa donation data string:', decodedString);
      
      const decodedData = JSON.parse(decodedString);
      console.log('Parsed eSewa donation callback data:', JSON.stringify(decodedData, null, 2));

      if (decodedData.status !== "COMPLETE") {
        console.error('eSewa donation payment not complete. Status:', decodedData.status);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/donate?status=failed&reason=incomplete_payment`);
        return;
      }

      // Extract transaction details
      const donationId = decodedData.transaction_uuid;
      
      // Check if donation exists
      const donation = await Donation.findById(donationId);
      if (!donation) {
        console.error('Donation not found for transaction_uuid:', donationId);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/donate?status=failed&reason=donation_not_found`);
        return;
      }

      // Check if donation is already completed
      if (donation.status === 'completed') {
        console.log('Donation already completed:', donationId);
        res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/donate?status=success&donationId=${donationId}`);
        return;
      }

      // Update donation status
      console.log('Updating donation payment status to completed');
      donation.status = 'completed';
      donation.paymentMethod = 'esewa';
      await donation.save();

      // Update charity raised amount
      const charity = await Charity.findById(donation.charityId);
      if (charity) {
        charity.raised += donation.amount;
        await charity.save();
      }

      console.log('Donation payment completed:', donationId);
      
      // Redirect back to client success page
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      const redirectUrl = `${clientUrl}/donate?status=success&donationId=${donationId}`;
      console.log('Redirecting to:', redirectUrl);
      
      res.redirect(redirectUrl);
    } catch (parseError) {
      console.error('Error parsing eSewa donation data:', parseError);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/donate?status=failed&reason=parse_error`);
      return;
    }
  } catch (error) {
    console.error('Error processing eSewa donation success callback:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/donate?status=failed&reason=server_error`);
  }
});

// Get all donations (admin only)
router.get('/all', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const donations = await Donation.find()
      .sort({ createdAt: -1 });
    
    res.json(donations);
  } catch (error) {
    next(error);
  }
});

// Get user's donations
router.get('/user/:userId', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    if (req.user._id.toString() !== req.params.userId && !req.user.isAdmin) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const donations = await Donation.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
    
    res.json(donations);
  } catch (error) {
    next(error);
  }
});

// Get donation statistics
router.get('/stats', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const totalDonations = await Donation.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const charityStats = await Donation.aggregate([
      {
        $group: {
          _id: '$charityId',
          charityName: { $first: '$charityName' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      total: totalDonations[0] || { totalAmount: 0, count: 0 },
      charityStats
    });
  } catch (error) {
    next(error);
  }
});

// Initiate Khalti payment for donations
router.post('/khalti-payment', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { donationId, amount, charityId } = req.body;
    
    console.log('Initiating Khalti donation payment with data:', JSON.stringify(req.body, null, 2));
    
    if (!donationId || !amount) {
      res.status(400).json({ message: 'Please provide donation ID and amount' });
      return;
    }

    // Find donation
    const donation = await Donation.findById(donationId);
    if (!donation) {
      res.status(404).json({ message: 'Donation not found' });
      return;
    }

    // Find charity
    const charity = await Charity.findById(charityId || donation.charityId);
    if (!charity) {
      res.status(404).json({ message: 'Charity not found' });
      return;
    }

    // Convert amount to paisa (Khalti requires amount in paisa)
    const amountInPaisa = Math.round(parseFloat(amount) * 100);
    
    // Get client URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    
    // Create Khalti payment request payload
    const khaltiPayload = {
      return_url: `${clientUrl}/donate?status=success&donationId=${donationId}`,
      website_url: clientUrl,
      amount: amountInPaisa,
      purchase_order_id: `donation_${donationId}`,
      purchase_order_name: `Donation to ${charity.name}`,
      customer_info: {
        name: `${req.user?.firstName} ${req.user?.lastName}`,
        email: req.user?.email,
        phone: req.user?.phone || ''
      }
    };
    
    // Get Khalti API Key from environment variables
    const khaltiApiKey = process.env.KHALTI_SECRET_KEY;
    
    if (!khaltiApiKey) {
      console.error('Khalti API key not configured');
      res.status(500).json({ message: 'Payment gateway not properly configured' });
      return;
    }
    
    // Make request to Khalti API
    const khaltiResponse = await axios.post(
      'https://dev.khalti.com/api/v2/epayment/initiate/',
      khaltiPayload,
      {
        headers: {
          'Authorization': `Key ${khaltiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Khalti payment initiation response:', khaltiResponse.data);
    
    if (khaltiResponse.data && khaltiResponse.data.payment_url) {
      // Update donation with Khalti payment reference
      donation.khaltiReference = {
        pidx: khaltiResponse.data.pidx,
        initiated: true
      };
      await donation.save();
      
      // Return payment URL to client
      res.json({
        message: 'Khalti donation payment initiated',
        paymentUrl: khaltiResponse.data.payment_url
      });
    } else {
      console.error('Khalti API error:', khaltiResponse.data);
      res.status(500).json({ message: 'Error initiating payment with Khalti' });
    }
  } catch (error) {
    console.error('Error initiating Khalti donation payment:', error);
    res.status(500).json({ message: 'Failed to initiate payment' });
  }
});

// Verify Khalti Payment Status
router.post('/khalti-verify', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { pidx, donation_id } = req.body;
    
    console.log('Khalti verification request received:', { pidx, donation_id });
    
    if (!pidx) {
      res.status(400).json({ message: 'Missing payment identifier' });
      return;
    }
    
    // Get Khalti API Key from environment variables
    const khaltiApiKey = process.env.KHALTI_SECRET_KEY;
    
    if (!khaltiApiKey) {
      console.error('Khalti API key not configured');
      res.status(500).json({ message: 'Payment gateway not properly configured' });
      return;
    }
    
    // Check if we've already processed this pidx
    if (donation_id) {
      const existingDonation = await Donation.findById(donation_id);
      if (existingDonation?.khaltiReference?.verified) {
        console.log(`Khalti payment ${pidx} for donation ${donation_id} was already verified. Skipping duplicate verification.`);
        res.json({ 
          status: 'Already Verified',
          message: 'This payment has already been verified and processed' 
        });
        return;
      }
    }
    
    // Make lookup request to Khalti API
    const khaltiResponse = await axios.post(
      'https://dev.khalti.com/api/v2/epayment/lookup/',
      { pidx },
      {
        headers: {
          'Authorization': `Key ${khaltiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Khalti payment verification response:', khaltiResponse.data);
    
    // Check if donation ID is provided
    if (donation_id) {
      // Find and update donation status
      const donation = await Donation.findById(donation_id);
      
      if (donation) {
        // Update donation status based on Khalti response
        if (khaltiResponse.data.status === 'Completed') {
          // Only update if the donation wasn't already completed
          if (donation.status !== 'completed') {
            console.log(`Updating donation ${donation_id} status to completed`);
            donation.status = 'completed';
            donation.khaltiReference = {
              ...donation.khaltiReference,
              verified: true,
              transactionId: khaltiResponse.data.transaction_id
            };
            
            // Update charity's raised amount
            const charity = await Charity.findById(donation.charityId);
            if (charity) {
              console.log(`Updating charity ${charity.name} raised amount from ${charity.raised} to ${charity.raised + donation.amount}`);
              charity.raised += donation.amount;
              await charity.save();
              console.log(`Updated charity ${charity.name} raised amount to ${charity.raised}`);
            }
          } else {
            console.log(`Donation ${donation_id} was already marked as completed. Avoiding double-counting.`);
          }
        } else if (['Refunded', 'Expired', 'User canceled'].includes(khaltiResponse.data.status)) {
          console.log(`Marking donation ${donation_id} as failed due to Khalti status: ${khaltiResponse.data.status}`);
          donation.status = 'failed';
        }
        
        await donation.save();
        console.log(`Saved donation ${donation_id} with updated status: ${donation.status}`);
      } else {
        console.log(`Donation ${donation_id} not found for Khalti payment ${pidx}`);
      }
    } else {
      console.log(`No donation_id provided for Khalti payment ${pidx}`);
    }
    
    res.json(khaltiResponse.data);
  } catch (error) {
    console.error('Error verifying Khalti payment:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
});

// eSewa payment callback handler
router.get('/esewa-callback', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('eSewa callback received with data:', req.query);
    
    // Get parameters from eSewa callback
    const { oid, amt, refId, status } = req.query;
    
    console.log(`Processing eSewa callback for donation: ${oid}`);
    
    // Check required fields
    if (!oid || !amt || !refId) {
      console.error('Missing required fields in eSewa callback');
      res.redirect('/donate?status=failed&reason=missing_fields');
      return;
    }
    
    // Extract donation ID from oid
    const donationIdMatch = String(oid).match(/donation_(\d+)/);
    
    if (status === 'COMPLETE') {
      // Update charity directly since we got verification from eSewa
      console.log(`Successfully processed eSewa payment for ${amt}`);
      
      // Redirect with success
      res.redirect(`/donate?status=success&donationId=${oid}`);
    } else {
      console.error('eSewa payment not complete. Status:', status);
      res.redirect('/donate?status=failed&reason=payment_failed');
    }
  } catch (error) {
    console.error('Error processing eSewa callback:', error);
    res.redirect('/donate?status=failed&reason=server_error');
  }
});

// Get donation by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const donation = await Donation.findById(req.params.id);
    
    if (!donation) {
      res.status(404).json({ message: 'Donation not found' });
      return;
    }
    
    res.json(donation);
  } catch (error) {
    console.error('Error fetching donation:', error);
    res.status(500).json({ message: 'Failed to fetch donation' });
  }
});

export default router; 
import express, { Request, Response, NextFunction } from 'express';
import { AuthRequest, verifyToken } from '../middleware/auth';
import Donation from '../models/Donation';
import { Charity } from '../models/Charity';
import crypto from 'crypto';

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
      userName: req.user.name,
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

export default router; 
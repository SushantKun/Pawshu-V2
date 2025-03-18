import express, { Request, Response, NextFunction } from 'express';
import { AuthRequest, verifyToken } from '../middleware/auth';
import Donation from '../models/Donation';
import { Charity } from '../models/Charity';

const router = express.Router();

// Create a new donation
router.post('/', verifyToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log('Creating new donation:', req.body);

    if (!req.user) {
      res.status(401).json({ message: 'Please authenticate' });
      return;
    }

    // Validate required fields
    const { charityId, charityName, amount } = req.body;
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
      status: req.body.status || 'completed',
      date: req.body.date || new Date()
    });

    console.log('Saving donation:', donation);
    await donation.save();
    console.log('Donation saved successfully:', donation._id);

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
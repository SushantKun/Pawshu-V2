import express, { Request, Response, RequestHandler } from 'express';
import { Charity, ICharity } from '../models/Charity';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Get all charities
router.get('/', (async (req: Request, res: Response) => {
  try {
    // Add cache-busting timestamp query parameter
    const shouldRefresh = req.query.refresh === 'true';
    
    // If refresh is requested, recalculate amounts from donations
    if (shouldRefresh) {
      console.log('Refreshing all charity progress from donations');
      const charities = await Charity.find();
      
      // Refresh each charity's raised amount from donations
      for (const charity of charities) {
        await charity.refreshRaisedAmount();
      }
      
      // Get the updated charities
      const refreshedCharities = await Charity.find();
      console.log('All charity progress refreshed');
      return res.json(refreshedCharities);
    }
    
    const charities = await Charity.find();
    res.json(charities);
  } catch (error) {
    console.error('Error fetching charities:', error);
    res.status(500).json({ message: 'Failed to fetch charities' });
  }
}) as RequestHandler);

// Update charity progress
router.put('/:id/progress', verifyToken, (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const charity = await Charity.findById(id);
    if (!charity) {
      return res.status(404).json({ message: 'Charity not found' });
    }

    charity.raised += amount;
    charity.updatedAt = new Date();
    await charity.save();

    res.json({ raised: charity.raised });
  } catch (error) {
    console.error('Error updating charity progress:', error);
    res.status(500).json({ message: 'Failed to update charity progress' });
  }
}) as RequestHandler);

// Reset all charity progress to zero
router.post('/reset-progress', (async (req: Request, res: Response) => {
  try {
    console.log('Resetting all charity progress to zero');
    
    // Update all charities to set raised amount to 0
    const result = await Charity.updateMany({}, { $set: { raised: 0 } });
    
    console.log('Reset complete. Updated', result.modifiedCount, 'charities');
    
    // Get the updated charities to return
    const updatedCharities = await Charity.find();
    
    res.json({ 
      message: 'All charity progress reset to zero', 
      modifiedCount: result.modifiedCount,
      charities: updatedCharities
    });
  } catch (error) {
    console.error('Error resetting charity progress:', error);
    res.status(500).json({ message: 'Failed to reset charity progress' });
  }
}) as RequestHandler);

export default router; 
import express, { Request, Response } from 'express';
import { Charity } from '../models/Charity';
import { verifyToken } from '../middleware/auth';
import { RequestHandler } from 'express';

const router = express.Router();

// Get all charities
router.get('/', (async (req: Request, res: Response) => {
  try {
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
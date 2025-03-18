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

export default router; 
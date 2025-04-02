import express, { Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import LostFound from '../models/LostFound';
import { uploadImage, deleteImage } from '../utils/cloudinary';
import { AuthRequest } from '../types/auth';
import mongoose from 'mongoose';
import { ParsedQs } from 'qs';

// Custom error types
class CustomError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

class NotFoundError extends CustomError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends CustomError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

const router = express.Router();

// Get all reports with filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      type,
      status,
      petType,
      search,
      lat,
      lng,
      radius = '50', // Default 50km radius
      sort = '-createdAt'
    } = req.query;

    const query: any = {};

    // Apply filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (petType) query.petType = petType;

    // Text search
    if (search) {
      query.$text = { $search: String(search) };
    }

    // Geospatial search
    if (lat && lng) {
      const radiusValue = Array.isArray(radius) ? radius[0] : radius;
      const parsedRadius = parseInt(String(radiusValue) || '50');
      
      query.lastLocation = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(String(lng)), parseFloat(String(lat))]
          },
          $maxDistance: parsedRadius * 1000 // Convert km to meters
        }
      };
    }

    const reports = await LostFound.find(query)
      .sort(String(sort))
      .populate('userId', 'name email')
      .populate('matches.reportId');

    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'An error occurred while fetching reports' });
  }
});

// Get a single report
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const report = await LostFound.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('matches.reportId');
    
    if (!report) {
      throw new NotFoundError('Report not found');
    }
    
    res.json(report);
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(error.status).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'An unknown error occurred' });
    }
  }
});

// Create a new report
router.post('/', verifyToken as any, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const reportData = {
      ...req.body,
      userId: req.user._id
    };

    // Upload images to Cloudinary if provided
    if (reportData.images && reportData.images.length > 0) {
      const uploadPromises = reportData.images.map(async (image: { url: string }) => {
        if (image.url.startsWith('data:')) {
          const result = await uploadImage(image.url);
          return {
            url: result.secure_url,
            public_id: result.public_id
          };
        }
        return image;
      });

      reportData.images = await Promise.all(uploadPromises);
    }

    const report = new LostFound(reportData);
    await report.save();

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'An error occurred while creating the report' });
  }
});

// Update a report
router.put('/:id', verifyToken as any, async (req: AuthRequest, res: Response) => {
  try {
    const report = await LostFound.findById(req.params.id);
    
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    if (!req.user?._id || report.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Not authorized to update this report');
    }

    // Handle image updates
    if (req.body.images) {
      // Delete old images
      const deletePromises = report.images
        .filter(image => image.public_id)
        .map(image => deleteImage(image.public_id as string));
      await Promise.all(deletePromises);

      // Upload new images
      const uploadPromises = req.body.images.map((image: string) => uploadImage(image));
      const uploadedImages = await Promise.all(uploadPromises);
      req.body.images = uploadedImages;
    }

    const updatedReport = await LostFound.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updatedReport);
  } catch (error) {
    if (error instanceof Error) {
      res.status(error instanceof NotFoundError ? error.status : 500)
        .json({ message: error.message });
    } else {
      res.status(500).json({ message: 'An unknown error occurred' });
    }
  }
});

// Delete a report
router.delete('/:id', verifyToken as any, async (req: AuthRequest, res: Response) => {
  try {
    const report = await LostFound.findById(req.params.id);
    
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    if (!req.user?._id || report.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Not authorized to delete this report');
    }

    // Delete images from storage
    if (report.images && report.images.length > 0) {
      const deletePromises = report.images
        .filter(image => image.public_id)
        .map(image => deleteImage(image.public_id as string));
      await Promise.all(deletePromises);
    }

    await LostFound.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    if (error instanceof Error) {
      res.status(error instanceof NotFoundError ? error.status : 500)
        .json({ message: error.message });
    } else {
      res.status(500).json({ message: 'An unknown error occurred' });
    }
  }
});

// Update match status
router.put('/:id/matches/:matchId', verifyToken as any, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const report = await LostFound.findById(req.params.id);
    
    if (!report) {
      throw new NotFoundError('Report not found');
    }

    if (!req.user?._id || report.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Not authorized to update this match');
    }

    const matchIndex = report.matches.findIndex(
      m => m.reportId?.toString() === req.params.matchId
    );

    if (matchIndex === -1) {
      throw new NotFoundError('Match not found');
    }

    report.matches[matchIndex].status = status;

    if (status === 'confirmed') {
      report.status = 'resolved';
      
      // Update the matched report as well
      await LostFound.findByIdAndUpdate(
        req.params.matchId,
        { 
          status: 'resolved',
          'matches.$[match].status': 'confirmed'
        },
        {
          arrayFilters: [{ 'match.reportId': report._id }]
        }
      );
    }

    await report.save();
    res.json(report);
  } catch (error) {
    if (error instanceof Error) {
      res.status(error instanceof NotFoundError ? error.status : 500)
        .json({ message: error.message });
    } else {
      res.status(500).json({ message: 'An unknown error occurred' });
    }
  }
});

// Update report status
router.patch('/:id/status', verifyToken as any, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const { status } = req.body;
    const report = await LostFound.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this report' });
    }

    report.status = status;
    await report.save();

    res.json(report);
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ message: 'An error occurred while updating the report' });
  }
});

export default router; 
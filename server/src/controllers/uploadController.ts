/**
 * Upload Controller
 * 
 * Handles file upload functionality
 */

import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Upload a file to Cloudinary
 * @route POST /api/upload
 */
export const uploadFile = async (req: any, res: Response) => {
  try {
    // Check if file was uploaded
    if (!req.files || !req.files.file) {
      console.error('No file in request:', req.files);
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.files.file;
    console.log('File uploaded to server:', file.name, 'size:', file.size, 'type:', file.mimetype);
    
    // Double-check Cloudinary configuration
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'duaa2t6lc',
      api_key: process.env.CLOUDINARY_API_KEY || '898283184416469',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'puZIzcZeNoM8FR_O1_lQQZgnBqs'
    });
    
    console.log('Current Cloudinary config:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'duaa2t6lc',
      folder: 'pawshu'
    });
    
    // Verify the file exists and has a path
    if (!file.tempFilePath || !require('fs').existsSync(file.tempFilePath)) {
      console.error('Temp file does not exist:', file.tempFilePath);
      return res.status(500).json({
        message: 'Error with temp file',
        error: 'Temporary file not created correctly'
      });
    }
    
    // Upload to Cloudinary with better promise handling
    try {
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: 'pawshu',
        use_filename: true,
        resource_type: 'auto' // Let Cloudinary detect the file type
      });
      
      console.log('File successfully uploaded to Cloudinary:', result.secure_url);
      
      // Return successful response
      return res.json({
        public_id: result.public_id,
        url: result.secure_url
      });
    } catch (cloudinaryError) {
      console.error('Detailed Cloudinary upload error:', JSON.stringify(cloudinaryError));
      return res.status(500).json({ 
        message: 'Error uploading to cloud storage',
        error: cloudinaryError.message || 'Unknown Cloudinary error'
      });
    }
  } catch (error) {
    console.error('Error in upload handler:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 
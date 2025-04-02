import { Router } from 'express';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

// Create router for upload paths
const router = Router();

// Upload route handler using express-fileupload
router.post('/', (req: any, res: any) => {
  try {
    // Check if file was uploaded
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.files.file;
    console.log('File uploaded to server:', file.name);
    
    // Upload to Cloudinary
    cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'pawshu',
      use_filename: true
    }).then(result => {
      console.log('File uploaded to Cloudinary:', result.secure_url);
      
      // File temp is automatically managed by express-fileupload
  
      res.json({
        public_id: result.public_id,
        url: result.secure_url
      });
    }).catch(error => {
      console.error('Error uploading to Cloudinary:', error);
      res.status(500).json({ message: 'Error uploading to cloud storage' });
    });
  } catch (error) {
    console.error('Error in upload handler:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 
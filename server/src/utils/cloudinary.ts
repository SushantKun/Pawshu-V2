import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if Cloudinary credentials are set
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

// Configure Cloudinary if credentials are available
if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary configured successfully with cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
} else if (process.env.CLOUDINARY_URL) {
  // If CLOUDINARY_URL is provided, use that instead
  // Parse the CLOUDINARY_URL to extract credentials
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  const match = cloudinaryUrl.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
  
  if (match) {
    const [, apiKey, apiSecret, cloudName] = match;
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });
    console.log('Cloudinary configured successfully using CLOUDINARY_URL with cloud name:', cloudName);
  } else {
    // Fallback to hardcoded values if parsing fails
    cloudinary.config({
      cloud_name: 'duaa2t6lc',
      api_key: '898283184416469',
      api_secret: 'puZIzcZeNoM8FR_O1_lQQZgnBqs'
    });
    console.log('Cloudinary configured with hardcoded values (fallback)');
  }
} else {
  console.warn('Cloudinary credentials not found. Image upload will be disabled.');
}

interface CloudinaryUploadResult {
  public_id: string;
  url: string;
}

// Upload image to Cloudinary
export const uploadImage = async (file: string): Promise<CloudinaryUploadResult> => {
  try {
    // Check if Cloudinary is configured
    if (!isCloudinaryConfigured && !process.env.CLOUDINARY_URL) {
      console.warn('Cloudinary not configured. Using placeholder image instead.');
      // Return a placeholder image
      return {
        public_id: 'placeholder',
        url: '/placeholder.svg'
      };
    }
    
    console.log('Uploading image to Cloudinary...');
    
    // Check if file is a string
    if (typeof file !== 'string') {
      console.error('Invalid image data: not a string');
      return {
        public_id: 'placeholder',
        url: '/placeholder.svg'
      };
    }
    
    // Check if file is too large (base64 string length > ~5MB)
    if (file.length > 7000000) {
      console.error('Image too large (>5MB)');
      return {
        public_id: 'placeholder',
        url: '/placeholder.svg'
      };
    }
    
    // Ensure the image is in the correct format for Cloudinary
    if (!file.startsWith('data:image/')) {
      console.error('Invalid image format. Image must start with data:image/');
      return {
        public_id: 'placeholder',
        url: '/placeholder.svg'
      };
    }
    
    try {
      const result = await cloudinary.uploader.upload(file, {
        folder: 'pawshu/doctors',
        use_filename: true,
        unique_filename: true,
      });
      
      console.log('Image uploaded successfully. URL:', result.secure_url);
      return {
        public_id: result.public_id,
        url: result.secure_url
      };
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      // Return placeholder instead of throwing
      return {
        public_id: 'placeholder',
        url: '/placeholder.svg'
      };
    }
  } catch (error) {
    console.error('Error in uploadImage function:', error);
    // Return placeholder instead of throwing
    return {
      public_id: 'placeholder',
      url: '/placeholder.svg'
    };
  }
};

// Delete image from Cloudinary
export const deleteImage = async (publicId: string): Promise<{ success: boolean }> => {
  try {
    // Check if Cloudinary is configured
    if (!isCloudinaryConfigured && !process.env.CLOUDINARY_URL) {
      console.warn('Cloudinary not configured. Skipping image deletion.');
      return { success: true };
    }
    
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw new Error('Image deletion failed');
  }
}; 
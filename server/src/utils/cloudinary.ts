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
      cloud_name: 'dnary',
      api_key: '898283184416469',
      api_secret: 'puZIzcZeNoM8FR_O1_lQQZgnBqs'
    });
    console.log('Cloudinary configured with hardcoded values (fallback)');
  }
} else {
  console.warn('Cloudinary credentials not found. Image upload will be disabled.');
}

interface CloudinaryResponse {
  public_id: string;
  secure_url: string;
}

// Upload image to Cloudinary
export const uploadImage = async (base64Image: string): Promise<CloudinaryResponse> => {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'pawshu/lost-found',
      use_filename: true,
      unique_filename: false,
    });

    return {
      public_id: result.public_id,
      secure_url: result.secure_url
    };
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw new Error('Failed to upload image');
  }
};

// Delete image from Cloudinary
export const deleteImage = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw new Error('Failed to delete image');
  }
}; 
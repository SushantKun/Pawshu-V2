const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');

// Load environment variables
dotenv.config();

console.log('Testing Cloudinary Configuration');
console.log('-------------------------------');
console.log('CLOUDINARY_URL:', process.env.CLOUDINARY_URL);
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY);
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'Set (hidden)' : 'Not set');

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary configured using individual credentials');
} else if (process.env.CLOUDINARY_URL) {
  // If CLOUDINARY_URL is provided, use that instead
  cloudinary.config({
    cloud_name: 'duaa2t6lc',
    api_key: '898283184416469',
    api_secret: 'puZIzcZeNoM8FR_O1_lQQZgnBqs'
  });
  console.log('Cloudinary configured using CLOUDINARY_URL');
} else {
  console.warn('Cloudinary credentials not found!');
  process.exit(1);
}

// Test Cloudinary connection
async function testCloudinary() {
  try {
    console.log('Testing Cloudinary connection...');
    const result = await cloudinary.api.ping();
    console.log('Cloudinary connection successful:', result);
  } catch (error) {
    console.error('Cloudinary connection failed:', error);
  }
}

testCloudinary(); 
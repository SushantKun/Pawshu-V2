import express, { Request, Response, NextFunction } from 'express';
import Product, { IProduct, ProductImage } from '../models/Product';
import { uploadImage, deleteImage } from '../utils/cloudinary';
import { verifyToken, adminAuth } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import { v2 as cloudinary } from 'cloudinary';

const router = express.Router();

// Get all products - Public route
const getAllProducts = async (req: Request, res: Response) => {
  try {
    console.log('GET /products - Fetching all products');
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get featured products - Public route
const getFeaturedProducts = async (req: Request, res: Response) => {
  try {
    console.log('GET /products/featured - Fetching featured products');
    const featuredProducts = await Product.find({ featured: true }).limit(4);
    res.status(200).json(featuredProducts);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single product - Public route
const getProductById = async (req: Request, res: Response) => {
  try {
    console.log(`GET /products/${req.params.id} - Fetching single product`);
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  category: 'Food' | 'Toys' | 'Accessories' | 'Health' | 'Travel';
  stock: number;
  featured?: boolean;
  images?: string[];
}

// Create new product (Admin only)
const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    console.log('POST /products - Creating new product');
    const { name, description, price, category, stock, featured, images } = req.body as CreateProductRequest;
    
    console.log('Product data received:', { 
      name, description, price, category, stock, featured, 
      images: images ? `${images.length} images` : 'No images' 
    });
    
    // Process and upload images if provided
    let uploadedImages: ProductImage[] = [];
    if (images && images.length > 0) {
      try {
        console.log(`Processing ${images.length} images for upload`);
        for (const image of images) {
          if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
            console.warn('Invalid image data received, skipping:', 
              typeof image === 'string' ? image.substring(0, 30) + '...' : typeof image);
            continue;
          }
          
          console.log('Uploading image to Cloudinary...');
          const uploadResult = await uploadImage(image);
          console.log('Image uploaded successfully, URL:', uploadResult.secure_url);
          uploadedImages.push({
            public_id: uploadResult.public_id,
            url: uploadResult.secure_url
          });
        }
        console.log(`Successfully uploaded ${uploadedImages.length} images`);
      } catch (imageError) {
        console.error('Error uploading images:', imageError);
        // Continue with product creation even if image upload fails
      }
    }
    
    const product = await Product.create({
      name,
      description,
      price,
      category,
      stock,
      featured: featured || false,
      images: uploadedImages
    });
    
    console.log('Product created successfully:', product._id);
    console.log('Product images:', product.images);
    res.status(201).json(product);
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  category?: 'Food' | 'Toys' | 'Accessories' | 'Health' | 'Travel';
  stock?: number;
  featured?: boolean;
  images?: string[];
  removedImages?: string[];
}

// Update product (Admin only)
const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`PUT /products/${id} - Updating product`);
    const { name, description, price, category, stock, featured, images, removedImages } = req.body as UpdateProductRequest;
    
    console.log('Update data received:', { 
      name, description, price, category, stock, featured, 
      images: images ? `${images.length} images` : 'No new images',
      removedImages: removedImages ? `${removedImages.length} images to remove` : 'No images to remove'
    });
    
    // Find the product
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Handle image updates
    let updatedImages = [...product.images];
    
    // Remove images if specified
    if (removedImages && removedImages.length > 0) {
      try {
        console.log(`Processing ${removedImages.length} images for removal`);
        for (const imageId of removedImages) {
          const imageToRemove = product.images.find(img => img.public_id === imageId);
          if (imageToRemove) {
            console.log(`Deleting image with public_id: ${imageToRemove.public_id}`);
            await deleteImage(imageToRemove.public_id);
            updatedImages = updatedImages.filter(img => img.public_id !== imageId);
          } else {
            console.warn(`Image with public_id ${imageId} not found in product images`);
          }
        }
        console.log(`After removal: ${updatedImages.length} images remaining`);
      } catch (deleteError) {
        console.error('Error deleting images:', deleteError);
        // Continue with product update even if image deletion fails
      }
    }
    
    // Add new images if provided
    if (images && images.length > 0) {
      try {
        console.log(`Processing ${images.length} new images for upload`);
        for (const image of images) {
          if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
            console.warn('Invalid image data received, skipping:', 
              typeof image === 'string' ? image.substring(0, 30) + '...' : typeof image);
            continue;
          }
          
          console.log('Uploading image to Cloudinary...');
          const uploadResult = await uploadImage(image);
          console.log('Image uploaded successfully, URL:', uploadResult.secure_url);
          updatedImages.push({
            public_id: uploadResult.public_id,
            url: uploadResult.secure_url
          });
        }
        console.log(`After additions: ${updatedImages.length} total images`);
      } catch (uploadError) {
        console.error('Error uploading new images:', uploadError);
        // Continue with product update even if image upload fails
      }
    }
    
    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        description,
        price,
        category,
        stock,
        featured: featured !== undefined ? featured : product.featured,
        images: updatedImages
      },
      { new: true, runValidators: true }
    );
    
    console.log('Product updated successfully:', updatedProduct?._id);
    console.log('Updated product images:', updatedProduct?.images);
    res.status(200).json(updatedProduct);
  } catch (error: any) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Delete product (Admin only)
const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`DELETE /products/${id} - Deleting product`);
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Delete images from Cloudinary
    if (product.images.length > 0) {
      console.log(`Deleting ${product.images.length} images from Cloudinary`);
      for (const image of product.images) {
        await deleteImage(image.public_id);
      }
    }
    
    // Delete product from database
    await Product.findByIdAndDelete(id);
    
    console.log('Product deleted successfully');
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register routes
router.get('/', getAllProducts as any);
router.get('/featured', getFeaturedProducts as any);
router.get('/:id', getProductById as any);
router.post('/', verifyToken, adminAuth as any, createProduct as any);
router.put('/:id', verifyToken, adminAuth as any, updateProduct as any);
router.delete('/:id', verifyToken, adminAuth as any, deleteProduct as any);

export default router; 
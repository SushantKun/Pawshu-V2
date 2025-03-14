const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { uploadImage, deleteImage } = require('../utils/cloudinary');
const { isAdmin } = require('../middleware/auth');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new product (Admin only)
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, description, price, category, stock, featured, images } = req.body;
    
    // Process and upload images if provided
    let uploadedImages = [];
    if (images && images.length > 0) {
      for (const image of images) {
        const uploadResult = await uploadImage(image);
        uploadedImages.push(uploadResult);
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
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Update product (Admin only)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { name, description, price, category, stock, featured, images, removedImages } = req.body;
    
    // Find the product
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Handle image updates
    let updatedImages = [...product.images];
    
    // Remove images if specified
    if (removedImages && removedImages.length > 0) {
      for (const imageId of removedImages) {
        const imageToRemove = product.images.find(img => img.public_id === imageId);
        if (imageToRemove) {
          await deleteImage(imageToRemove.public_id);
          updatedImages = updatedImages.filter(img => img.public_id !== imageId);
        }
      }
    }
    
    // Add new images if provided
    if (images && images.length > 0) {
      for (const image of images) {
        const uploadResult = await uploadImage(image);
        updatedImages.push(uploadResult);
      }
    }
    
    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
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
    
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Delete product (Admin only)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Delete images from Cloudinary
    for (const image of product.images) {
      await deleteImage(image.public_id);
    }
    
    // Delete product from database
    await Product.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 
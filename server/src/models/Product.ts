import mongoose, { Document, Schema } from 'mongoose';

export interface ProductImage {
  public_id: string;
  url: string;
}

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  category: 'Food' | 'Toys' | 'Accessories' | 'Health' | 'Grooming';
  stock: number;
  images: ProductImage[];
  featured: boolean;
  createdAt: Date;
}

const productSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'Please provide a product name'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide product description'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please provide product price'],
    min: [0, 'Price must be positive']
  },
  category: {
    type: String,
    required: [true, 'Please select product category'],
    enum: {
      values: ['Food', 'Toys', 'Accessories', 'Health', 'Grooming'],
      message: 'Please select correct category'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Please enter product stock'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  images: [
    {
      public_id: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      }
    }
  ],
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IProduct>('Product', productSchema); 
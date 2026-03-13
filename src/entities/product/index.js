import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'name is required'],
      trim: true,
      minlength: [3, 'name must be at least 3 characters long']
    },
    description: { 
      type: String, 
      default: '',
      trim: true
    },
    price: { 
      type: Number, 
      required: [true, 'price is required'],
      min: [0, 'price cannot be negative']
    },
    category: { 
      type: String, 
      default: '',
      trim: true
    },
    active: { 
      type: Boolean, 
      default: true 
    },
  },
  { timestamps: true }
);

export const Product = mongoose.model('Product', productSchema);

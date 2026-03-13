import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: [true, 'userId is required']
    },
    products: [{
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      quantity: { type: Number, required: true, min: [1, 'quantity must be at least 1'] },
      priceAtPurchase: { type: Number, required: true, min: [0, 'price cannot be negative'] }
    }],
    status: { 
      type: String, 
      enum: {
        values: ['PENDING', 'PAID', 'SHIPPED', 'CANCELLED'],
        message: '{VALUE} is not a valid status'
      }, 
      default: 'PENDING' 
    },
    totalAmount: { 
      type: Number, 
      required: [true, 'totalAmount is required'], 
      min: [0, 'amount cannot be negative'] 
    }
  },
  { timestamps: true }
);

export const Order = mongoose.model('Order', orderSchema);

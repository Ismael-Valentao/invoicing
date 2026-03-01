const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  receiptNumber: String,

  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },

  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: Number,
    price: Number,
    total: Number
  }],

  subtotal: Number,
  tax: Number,
  total: Number,
  paidAmount: Number,

  paymentMethod: {
    type: String,
    enum: ['cash', 'mpesa', 'emola', 'card', 'bank']
  },

  status: {
    type: String,
    enum: ['draft', 'confirmed', 'cancelled'],
    default: 'confirmed'
  }
}, { timestamps: true });

module.exports = mongoose.model('Sale', SaleSchema);
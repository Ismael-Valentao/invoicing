const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema({
  mpesa:      { type: String, default: '' },
  emola:      { type: String, default: '' },
  bankName:   { type: String, default: '' },
  bankHolder: { type: String, default: '' },
  bankNIB:    { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);

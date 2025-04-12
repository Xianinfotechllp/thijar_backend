const mongoose = require("mongoose");

// Item Settings schema
const transactionSettingsSchema = new mongoose.Schema({
  enableDeliveryChallan: {
    type: Boolean,
    default: false,
  },
  enableEstimate: {
    type: Boolean,
    default: false,
  },
  enableSalesOrder: {
    type: Boolean,
    default: false,
  },
  enableExportSales: {
    type: Boolean,
    default: false,
  },
  enablePurchaseOrder: {
    type: Boolean,
    default: false,
  },
  enableImportPurchase: {
    type: Boolean,
    default: false,
  },
  enableShippingAddress: {
    type: Boolean,
    default: false,
  },
  enablePartyEmail: {
    type: Boolean,
    default: false,
  },
  enableStateOfSupply: {
    type: Boolean,
    default: false
  },
  enableInvoicePreview: {
    type: Boolean,
    default: false
  },
  companyDetails: {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
    },
  },
  createdBy: {
    type: mongoose.Types.ObjectId,
    ref: "User",
  },
});

module.exports = mongoose.model(
  `transactionSettings`,
  transactionSettingsSchema
);

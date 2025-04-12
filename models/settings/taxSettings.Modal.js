const mongoose = require("mongoose");

// Item Settings schema
const taxSettingsSchema = new mongoose.Schema({
  enableGstPercent: {
    type: Boolean,
    default: false,
  },
  enableVatPercent: {
    type: Boolean,
    default: false,
  },
  enableEWayBill: {
    type: Boolean,
    default: false,
  },
  enableEInvoice: {
    type: Boolean,
    default: false,
  },
  enableMyOnlineStore: {
    type: Boolean,
    default: false,
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

module.exports = mongoose.model(`taxSettings`, taxSettingsSchema);

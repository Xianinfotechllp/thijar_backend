const mongoose = require("mongoose");

// Item Settings schema
const itemSettingsSchema = new mongoose.Schema({
  enableItem: {
    type: Boolean,
    default: true,
  },
  whatDoYouSell: {
    type: String,
    enum: ["Product/Service", "Product", "Service"],
    default: "Product/Service",
  },
  barcodeScan: {
    type: Boolean,
    default: false,
  },
  stockMaintainance: {
    type: Boolean,
    default: false,
  },
  showLowStockDialog: {
    type: Boolean,
    default: false,
  },
  enableItemsUnit: {
    type: Boolean,
    default: true,
  },
  enableDefaultUnit: {
    type: Boolean,
    default: false,
  },
  defaultUnit: {
    type: mongoose.Types.ObjectId,
    default: null,
  },
  // enableItemCategory: {
  //   type: Boolean,
  //   default: false,
  // },
  enableItemScanner: {
    type: Boolean,
    default: false
  },
  enableItemwiseTax: {
    type: Boolean,
    default: false,
  },
  enableItemwiseDiscount: {
    type: Boolean,
    default: false,
  },
  enableWholeSalePrice: {
    type: Boolean,
    default: false,
  },
  // enableGstPercent: {
  //   type: Boolean,
  //   default: false,
  // },
  // enableVatPercent: {
  //   type: Boolean,
  //   default: false,
  // },

  //item input fields
  enableItemCode: {
    type: Boolean,
    default: false,
  },
  enableItemCategory: {
    type: Boolean,
    default: false,
  },
  enableItemHsn: {
    type: Boolean,
    default: false,
  },
  enableItemDiscount: {
    type: Boolean,
    default: false,
  },
  enableItemMrp: {
    type: Boolean,
    default: false,
  },
  enableItemTypes: {
    type: Boolean,
    default: false,
  },

  //decimal places
  quantityDecimalPlaces: {
    type: Number,
    default: 2,
  },
  commonDecimalPlaces: {
    type: Number,
    default: 2,
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

module.exports = mongoose.model(`itemSettings`, itemSettingsSchema);

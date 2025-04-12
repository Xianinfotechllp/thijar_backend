const mongoose = require("mongoose");

const conversionSchema = new mongoose.Schema(
  {
    baseUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Units",
      required: true,
    },
    secondaryUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Units",
      required: true,
    },
    conversionRate: {
      type: Number,
      required: true,
      min: 1
    },
    companyDetails: {
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Companies',
        required: true
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        // ref: 'Companies',
        required: false,
        default: null
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    }
  },
  { timestamps: true, collection: 'unitConversions' }
);

const Conversion = mongoose.model("unitConversions", conversionSchema);

module.exports = Conversion;

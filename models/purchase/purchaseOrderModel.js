const mongoose = require("mongoose");

const PurchaseOrderSchema = new mongoose.Schema(
  {
    godown: {
      type: mongoose.Schema.Types.ObjectId,
      // required: true,
      ref: "Godowns"
    },
    orderNo: {
      type: String,
      default: "",
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: Date.now,
    },
    isConverted: {
      type: Boolean,
      default: false,
    },
    conversionDetails: {
      documentId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "conversionDetails.documentType",
      },
      documentType: {
        type: String,
        enum: ["Purchases"],
        default: "Purchases",
      },
      documentNo: {
        type: String,
        default: "",
      },
      isDeleted: {
        type: Boolean,
        default: false,
      },
    },
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
    },
    partyName: {
      type: String,
      default: "",
    },
    stateOfSupply: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
    },
    image: {
      type: String,
      default: "",
    },
    document: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank'],
    //     default: ""
    // },
    // bankName: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Banks',
    //     validate: {
    //         validator: function (value) {
    //             return this.paymentMethod !== 'Bank' || value != null;
    //         },
    //         message: 'Bank name is required when payment method is "Bank".'
    //     }
    // },
    // referenceNo: {
    //     type: String,
    //     default: "" // Default value for referenceNo
    // },
    paymentMethod: [
      {
        method: {
          type: String,
          enum: ["Cash", "Cheque", "Bank"],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        bankName: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Banks",
          validate: {
            validator: function (value) {
              return this.method !== "Bank" || value != null;
            },
            message: 'Bank name is required when payment method is "Bank".',
          },
        },
        referenceNo: {
          type: String,
          default: "",
        },
        chequeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Cheque",
          // validate: {
          //     validator: function (value) {
          //         return this.method !== 'Cheque' || value != null;
          //     },
          //     message: 'Cheque Id is required when payment method is "Cheque".'
          // },
          default: null,
        },
      },
    ],
    items: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Products",
        },
        quantity: {
          type: Number,
          default: 0,
        },
        unit: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Units",
          default: null,
        },
        price: {
          type: Number,
          default: 0,
        },
        discountPercent: {
          type: Number,
          default: 0,
        },
        taxPercent: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "taxRates",
          default: null,
        },
        taxAmount: {
          type: Number,
          defaut: 0,
          min: 0,
        },
        finalAmount: {
          type: Number,
          default: 0,
        },
      },
    ],
    totalDiscount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    advanceAmount: {
      type: Number,
      default: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
    },
    // isConverted: {
    //   type: Boolean,
    //   default: false,
    // },
    // conversionDetails: {
    //   documentId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     refPath: "Purchase",
    //   },
    //   documentNo: {
    //     type: String,
    //     default: "",
    //   },
    // },
    companyDetails: {
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Companies",
        required: true,
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        // ref: 'Companies',
        required: false,
        default: null,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    status: {
      type: String,
      enum: ["Order Open", "Order Overdue", "Order Closed"],
      default: "Order Open",
    },
  },
  { timestamps: true, collection: "PurchaseOrders" }
);

PurchaseOrderSchema.pre("save", function (next) {
  if (this.paymentMethod === "Bank" && !this.bankName) {
    return next(
      new Error('Bank name is required when payment method is "Bank".')
    );
  }

  next();
});

module.exports = mongoose.model("PurchaseOrders", PurchaseOrderSchema);

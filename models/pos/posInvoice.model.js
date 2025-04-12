const mongoose = require("mongoose");


const posInvoiceSchema = new mongoose.Schema({
    invoiceType: { type: String, enum: ["sale", "sale-return"], default: "sale" },
    invoiceNo: { type: String, required: true },
    date: { type: Date, default: Date.now },
    mode: { type: String, enum: ["Cash", "Bank", "Card", "UPI"], required: true },
    bankName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Banks',
        validate: {
            validator: function (value) {
                return this.method !== 'Bank' || value != null;
            },
            message: 'Bank name is required when payment method is "Bank".'
        }
    },
    customerName: { type: String },
    card: { type: String },
    phone: { type: String },
    items: [
        {
            itemId: mongoose.Types.ObjectId,
            name: String,
            qty: Number,
            price: Number,
            amount: Number,
        },
    ],
    totalQty: { type: Number },
    taxableAmount: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    rewards: {
        type: String,
    },
    totalDiscount: {
        type: Number,
        default: 0
    },
    totalAmount: { type: Number },

    status: { type: String, default: "Completed" },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: "Users"
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
});

const PosInvoice = mongoose.model("posinvoices", posInvoiceSchema);
module.exports = PosInvoice;

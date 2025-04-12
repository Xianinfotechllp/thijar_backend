
const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
    name: {
        type: String,
        default: "",
        trim: true
    },
    gstIn: {
        type: String,
        default: ""
    },
    businessType: {
        type: String,
        enum: ['B2C', 'B2B']
    },
    gstType: {
        type: String,
        enum: ['Unregistered/Consumer', 'Registered Business-Regular', 'Registered Business-Composition']
    },
    contactDetails: {
        email: {
            type: String,
            default: ""
        },
        phone: {
            type: String,
            default: ""
        }
    },
    state: {
        type: mongoose.Types.ObjectId,
        ref: 'States',
        required: false,
    },
    billingAddress: {
        type: String,
        default: ""
    },
    shippingAddress: {
        //If User enabled Shipping Address for  Parties
        type: String,
        default: ""
    },
    openingBalanceDetails: {
        openingBalance: {
            type: Number,
            default: 0
        },
        date: {
            type: Date
        },
        balanceType: {
            type: String,
            enum: ['toPay', 'toReceive'],
            default: 'toReceive'
        }
    },

    creditLimit: {
        type: Number,
        default: 0,
        min: 0
    },

    balanceDetails: {
        receivableBalance: {
            type: Number,
            default: 0
        },
        payableBalance: {
            type: Number,
            default: 0
        },
    },

    receivedAmount: {
        type: Number,
        default: 0,
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    additionalField1: {
        type: String,
        default: ""
    },
    additionalField2: {
        type: String,
        default: ""
    },
    additionalField3: {
        type: String,
        default: ""
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
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
})


module.exports = mongoose.model('Party', partySchema);
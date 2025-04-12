const mongoose = require('mongoose');

const DebitNoteModel = new mongoose.Schema({
    returnNo: {
        type: String,
        default: ""
    },
    billDetails: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Purchase'
    },
    billNo: {
        type: String,
        default: ""
    },
    billDate: {
        type: Date
    },
    date: {
        type: Date
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party'
    },
    partyName: {
        type: String,
        required: true
    },
    billingAddress: {
        type: String,
        default: ""
    },
    phoneNo: {
        type: String,
        default: ""
    },
    stateOfSupply: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'State'
    },
    description: {
        type: String,
        default: ""
    },
    image: String,
    // paymentMethod: {
    //     type: String,
    //     enum: ['Cash', 'Cheque', 'Bank']
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
    paymentMethod: [
        {
            method: {
                type: String,
                enum: ['Cash', 'Cheque', 'Bank'],
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
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
            referenceNo: {
                type: String
            },
            chequeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Cheque',
                // validate: {
                //     validator: function (value) {
                //         return this.method !== 'Cheque' || value != null;
                //     },
                //     message: 'Cheque Id is required when payment method is "Cheque".'
                // },
                default: null
            }
        }
    ],
    items: [
        {
            itemId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Products'
            },
            quantity: {
                type: Number,
                default: 0
            },
            unit: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Units',
                default: null
            },
            price: {
                type: Number,
                default: 0
            },
            discountPercent: {
                type: Number,
                default: 0
            },
            taxPercent: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'taxRates',
                default: null
            },
            taxAmount: {
                type: Number,
                defaut: 0,
                min: 0
            },
            finalAmount: {
                type: Number,
                default: 0
            }
        }
    ],
    totalDiscount: {
        type: Number,
        default: 0,
        min: 0
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    receivedAmount: {
        type: Number,
        default: 0
    },
    balanceAmount: {
        type: Number,
        default: 0
    },
    source: {
        type: String,
        enum: ['Direct', 'Invoice']
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
        ref: 'Users'
    }
}, { timestamps: true });

module.exports = mongoose.model('DebitNotes', DebitNoteModel);

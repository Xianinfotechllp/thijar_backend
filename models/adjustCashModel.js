const mongoose = require('mongoose');


const AdjustCashModel = new mongoose.Schema({

    adjustmentType: {
        type: String,
        enum: ['Add', 'Reduce'],
    },
    amount: {
        type: Number,
        default: 0
    },
    adjustmentDate: {
        type: Date,
        default: Date.now()
    },
    description: {
        type: String,
        default: ""
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
    },

}, { timestamps: true });


module.exports = mongoose.model('cashadjustments', AdjustCashModel);
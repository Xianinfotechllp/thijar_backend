const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ExpenseItemSchema = new Schema({
    name: {
        type: String,
        default: ""
    },
    hsnCode: {
        type: String,
        default: ""
    },
    price: {
        type: Number,
        default: 0
    },
    taxIncluded: {
        type: Boolean,
        default: false
    },
    taxRate: {
        type: Schema.Types.ObjectId,
        ref: 'taxRates'
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
        type: Schema.Types.ObjectId,
        ref: 'Users'
    }
}, { timestamps: true });

module.exports = mongoose.model('ExpenseItem', ExpenseItemSchema);

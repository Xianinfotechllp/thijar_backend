    const mongoose = require('mongoose');

    const stockTransferSchema = new mongoose.Schema({
        transferDate: {
            type: Date,
            default: Date.now
        },
        fromGodown: {
            type: mongoose.Types.ObjectId,
            ref: "Godowns"
        },
        toGodown: {
            type: mongoose.Types.ObjectId,
            ref: "Godowns"
        },
        items: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Products',
                    required: true
                },
                quantity: {
                    type: Number,
                    required: true,
                    default: 0
                },
            }
        ],
        totalQuantity: {
            type: Number,
            required: true,
            min: 0
        },
        companyDetails: {
            companyId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Companies',
                required: true
            },
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                default: null
            }
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Users',
            required: true
        }
    }, { timestamps: true });

    module.exports = mongoose.model('stockTransfers', stockTransferSchema);

const mongoose = require('mongoose');

// General Settings schema
const generalSettingsSchema = new mongoose.Schema({
    general: {
        selectedLanguage: { type: String, default: "English" },
        currencyDenomination: { type: String, default: "Rs." },
        enablePasswordAuthentication: { type: Boolean, default: false },
        enableStockTransfer: { type: Boolean, default: false },
        dateFormat: { type: String, default: "DD-MM-YYYY" },
        denomination: { type: String, default: "1" },
        enableEstimate: { type: Boolean, default: true },
        // enableTransaction: {
        //     Estimate: {
        //         type: Boolean,
        //         default: true
        //     },
        //     saleAndPurchaseOrder: {
        //         type: Boolean,
        //         default: true
        //     },
        //     otherIncome: {
        //         type: Boolean,
        //         default: false
        //     },
        //     fixedAsset: {
        //         type: Boolean,
        //         default: false
        //     },
        //     deliveryChallan: {
        //         type: Boolean,
        //         default: false
        //     }
        // }
        enableMultiFirm: {
            type: Boolean,
            default: false
        },
    },


    companyDetails: {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Companies',
            required: true
        },
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }

}, { timestamps: true });

module.exports = mongoose.model('GeneralSettings', generalSettingsSchema)

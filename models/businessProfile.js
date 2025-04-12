const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema({
    businessName: {
        type: String,
        required: false,
        default: "",
        trim: true
    },
    email: {
        type: String,
        required: false,
        default: "",
        trim: true
    },
    gstIn: {
        type: String,
        default: "",
        trim: true
    },
    logo: {
        type: String,
        default: ""
    },
    phoneNo: {
        type: String,
        default: ""
    },
    businessAddress: {
        type: String,
        default: ""
    },
    businessType: {
        type: String,
        enum: ['None', 'Retail', 'Wholesale', 'Distributor', 'Service', 'Manufacturing'],
        default: 'None',
    },
    businessCategory: {
        type: String,
        default: ""
    },
    pincode: {
        type: String,
    },
    state: {
        type: String,
        default: '',
    },
    country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Countries',
        default: null
    },
    businessDescription: {
        type: String,
        maxlength: 160,
        default: ""
    },
    signature: {
        type: String,
        default: ""
    },
    companyDetails: {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Companies',
            required: true
        },
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true,
    },
}, { timestamps: true, collection: "businessProfiles" });

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);

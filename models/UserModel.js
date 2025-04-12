const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    countryCode: {
        type: String,
        // required: true,
    },
    phoneNo: {
        type: String,
        required: true,
        maxlength: 30,
    },
    email: {
        type: String,
        required: false,
    },
    passCode: {
        type: String,
        default: ""
    },
    otpCode: {
        type: String,
        default: null,
    },
    otpExpiration: {
        type: Date,
        default: null,
    },
    role: {
        type: String,
        default: 'Admin'
    },
    isPhoneNoVerified: {
        type: Boolean,
        default: false
    },
    // businessProfileId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'BusinessProfile',
    //     default: null
    // }, 
    companies: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Companies',
    }],
    lastLoginAs: {
        type: Object, // Stores the role and company ID
        default: null, // Example: { role: "subUser", companyId: "companyObjectId" }
    },
}, { timestamps: true, collection: "users" });

module.exports = mongoose.model('Users', userSchema);

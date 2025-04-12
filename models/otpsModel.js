const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    phoneNo: {
        type: String,
        required: true,
    },
    otpCode: {
        type: String,
        required: true,
    },
    otpExpiration: {
        type: Date,
        required: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true, collection: 'otps' });

module.exports = mongoose.model('OTPs', otpSchema);
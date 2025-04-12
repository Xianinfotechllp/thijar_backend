
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    IsSelected: {
        type: Boolean,
        default: false
    },
    companyName: {
        type: String,
        trim: true
    },
    phoneNo: {
        type: String,
        default: "",
        trim: true
    },
    email: {
        type: String,
        default: "",
    },
    businessProfileId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    users: [
        {
            type: mongoose.Schema.ObjectId,
            ref: "subUsers"
        }
    ],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Users'
    }
}, { timestamps: true });

module.exports = mongoose.model('Companies', companySchema);

const mongoose = require('mongoose');

const godownSchema = new mongoose.Schema({
    isMain: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        enum: ["Main", "Godown", "Retail Store", "Wholesale Store", "Assembly Plant", "Others"],
        default: "Main"
    },
    name: {
        type: String,
        trim: true
    },

    phoneNo: {
        type: String,
        required: false,
        default: ""
    },
    email: {
        type: String,
        required: false,
        default: ""
    },

    location: {
        type: String,
        default: ""
    },
    gstIn: {
        type: String,
        default: ""
    },
    pinCode: {
        type: String,
        default: "",
    },
    address: {
        type: String,
        default: "",
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Companies',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Godowns', godownSchema);

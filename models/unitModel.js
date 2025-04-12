const mongoose = require('mongoose');

const UnitSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        // unique: true
    },
    shortName: {
        type: String,
        required: true,
        // unique: true
    },
    conversionReferences: {
        type: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'unitConversions', // Reference to the unitConversions model
            }
        ],
        default: [] // Default to an empty array
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
    },
    companyDetails: {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Companies',
            required: true
        },
    },

}, { timestamps: true })


// Compound index to ensure Name is unique per createdBy
// UnitSchema.index({ 'companyDetails.companyId': 1 }, { unique: true });
module.exports = mongoose.model('Units', UnitSchema);
const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
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
        ref: "Users"
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    updatedAt:
    {
        type: Date,
        default: Date.now()
    }
}, { collection: "categories" }
    ,
)

module.exports = mongoose.model('Categories', CategorySchema);
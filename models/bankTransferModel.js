const mongoose = require("mongoose");


const BankTransferSchema = new mongoose.Schema(
    {
        transferType: {
            type: String,
            enum: ['bank_to_cash', 'cash_to_bank', 'bank_to_bank', 'bank_to_party'],
            required: true,
        },

        // Debit (withdrawal), Credit (deposit)
        transactionType: {
            type: String,
            enum: ['debit', 'credit'],
            required: true,
        },

        //if transferType=cash_to_bank then keeping source null (No source bank needed for cash to bank)
        source: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Banks',
            required: function () {
                return this.transferType !== 'cash_to_bank';
            },
        },


        destinationBank: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Banks',
        },
        destinationParty: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Party',
        },
        isCashDestination: {
            type: Boolean, 
            default: false,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        transferDate: {
            type: Date,
            required: true,
        },
        description: {
            type: String,
            trim: true,
        },
        image: {
            type: String,
            default: "",
        },
        companyDetails: {
            companyId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Companies',
                required: true,
            },
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                default: null,
            },
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
        },
    },
    {
        timestamps: true,
    }
);


module.exports = mongoose.model("bankTransfers", BankTransferSchema);
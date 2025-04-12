const Banks = require("../../models/bankModel");
const ChequeTransfer = require("../../models/chequeTransferModel");
const Transactions = require("../../models/transactionModel");
const mongoose = require("mongoose");

exports.getBankAccountList = async (req, res) => {
    try {
        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
                    transactionType: { $in: ['Sale', 'Purchase', 'Debit Note', 'Credit Note', 'Payment-In', 'Payment-Out'] }
                }
            },
            {
                $unwind: '$paymentMethod'
            }, {
                $group: {
                    _id: '$paymentMethod.bankName',
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $in: ['$transactionType', ['Sale', 'Debit Note', 'Payment-In']] },
                                '$paymentMethod.amount',
                                { $multiply: ['$paymentMethod.amount', -1] }
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'banks',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'Bank'
                }
            },
            {
                $project: {
                    _id: 0,
                    bankName: { $arrayElemAt: ['$Bank.bankName', 0] },
                    totalAmount: 1,
                    Bank: { $arrayElemAt: ['$Bank', 0] }
                }
            }
        ]);

        const chequeTransferList = await ChequeTransfer.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
                    accountName: "Bank",
                }
            }, {
                $group: {
                    _id: '$bank',
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $in: ['$transactionType', ['deposit']] },
                                '$amount',
                                { $multiply: ['$amount', -1] }
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'banks',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'Bank'
                }
            },
            {
                $project: {
                    _id: 0,
                    bankName: { $arrayElemAt: ['$Bank.bankName', 0] },
                    totalAmount: 1,
                }
            }
        ]);

        const bankDetails = await Banks.find({
            createdBy: req.user, 'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
        }).select('openingBalance bankName asOfDate');

        bankDetails.map(bank => {
            TransactionList.push({
                transactionType: 'Opening Balance',
                bankName: bank.bankName,
                totalAmount: bank.openingBalance,
                transactionDate: bank.asOfDate
            });
        });


        const combinedList = [...TransactionList, ...chequeTransferList];

        // Summing up by bankName
        const combinedTotals = combinedList.reduce((acc, item) => {
            const { bankName, totalAmount } = item;
            if (bankName) {
                acc[bankName] = (acc[bankName] || 0) + totalAmount;
            }
            return acc;
        }, {});

        // Convert to array format
        const result = Object.entries(combinedTotals).map(([bankName, totalAmount]) => ({
            bankName,
            totalAmount
        }));


        res.status(200).json({ message: "Combined Bank Account Totals", data: result });
    } catch (error) {
        console.log(error);

        res.status(500).json({ message: "Internal Server Error", error: error || error.message });
    };
};


exports.getTransactionForBank = async (req, res) => {

    try {
        let { bank } = req.params;

        if (!bank) {
            return res.status(400).json({ status: "Failed", message: 'Bank is required' });
        };

        const bankDetails = await Banks.findOne({
            bankName: bank, createdBy: req.user, 'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
        });

        if (!bankDetails) {
            return res.status(404).json({ status: "Failed", message: 'Bank not found' });
        };

        let bankId = bankDetails._id;

        let TransactionList = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
                    transactionType: { $in: ['Sale', 'Purchase', 'Debit Note', 'Credit Note', 'Payment-In', 'Payment-Out'] }
                }
            },
            {
                $unwind: '$paymentMethod'
            },
            {
                $match: { 'paymentMethod.bankName': new mongoose.Types.ObjectId(bankId) }
            }, {
                $lookup: {
                    from: 'parties',
                    localField: 'party',
                    foreignField: "_id",
                    as: 'partyDetails'
                }
            },
            {
                $project: {
                    _id: 0,
                    bankName: bank,
                    amount: "$paymentMethod.amount",
                    transactionDate: 1,
                    transactionType: 1,
                    name: { $arrayElemAt: ["$partyDetails.name", 0] }
                }
            }
        ]);


        const chequeTransferList = await ChequeTransfer.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
                    accountName: "Bank",
                    bank: new mongoose.Types.ObjectId(bankId)
                }
            },
            {
                $project: {
                    _id: 0,
                    bankName: bank,
                    transactionType: 1,
                    createdAt: 1,
                    amount: 1,
                }
            }
        ]);

        chequeTransferList.forEach((item) => {
            TransactionList.push({
                transactionType: `Cheque ${item.transactionType}`,
                transactionDate: item.createdAt,
                name: "Cheque Transfer",
                amount: item.amount
            });
        });

        TransactionList.push({
            transactionType: 'Opening Balance',
            name: "Opening Balance",
            amount: bankDetails.openingBalance,
            transactionDate: bankDetails.asOfDate
        });


        let totalAmount = 0;
        TransactionList.map(transaction => {
            if (['Sale', 'Debit Note', 'Payment-In', 'Cheque deposit', 'Opening Balance'].includes(transaction.transactionType))
                totalAmount += parseFloat(transaction.amount);
            else totalAmount -= parseFloat(transaction.amount);
        });


        // Sort transactions by date (descending order)
        const sortedTransactionList = TransactionList.sort((a, b) =>
            new Date(a.transactionDate) - new Date(b.transactionDate)
        );

        res.status(200).json({ message: "Bank Transactions Successfully fetched", data: sortedTransactionList, totalAmount });

    }
    catch (error) {
        console.log(error);

        res.status(500).json({ message: "Internal Server Error", error: error || error.message });
    }
}
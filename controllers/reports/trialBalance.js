const Sales = require("../../models/invoiceModel");
const PaymentIn = require("../../models/paymentInModel");
const Transactions = require("../../models/transactionModel");
const BankTransfers = require("../../models/bankTransferModel");
const Expenses = require("../../models/purchase/expenseModel");
const Products = require("../../models/productModel");
const mongoose = require("mongoose");

const getCurrentAssets = async (userId, companyId) => {
    try {
        let data = {};
        const estimatedDoubtfulPercentage = 0.10; // 10% doubtful account estimate


        // Fetching transactions related to Cash Equivalents
        const transactions = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: {
                        $in: ["Credit Note", "Sale", "Payment-In", "Debit Note", "Payment-Out"]
                    },
                    paymentType: { $ne: 'Credit' }
                }
            },
            {
                $unwind: '$paymentMethod'
            },
            {
                $match: {
                    "paymentMethod.method": "Cash"
                }
            },
            {
                $group: {
                    _id: "$transactionType",
                    totalAmount: { $sum: "$totalAmount" }
                }
            },
            {
                $unionWith: {
                    coll: "banktransfers",
                    pipeline: [
                        {
                            $match: {
                                createdBy: new mongoose.Types.ObjectId(userId),
                                "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                                transferType: { $in: ["bank_to_cash", "cash_to_bank"] },
                            },
                        },
                        {
                            $group: {
                                _id: "$transferType",
                                totalAmount: { $sum: "$amount" }
                            }
                        }
                    ]
                }
            }
        ]);

        // Credit Sales (Accounts Receivable)
        const creditTransactions = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: { $in: ["Credit Note", "Sale", "Payment-In"] },
                    paymentType: { $ne: "Cash" }
                }
            },
            {
                $group: {
                    _id: "$transactionType",
                    totalAmount: { $sum: "$totalAmount" },
                    totalBalance: { $sum: "$balance" },
                }
            }
        ]);

        // Convert transaction results into an object
        const transactionData = {};
        transactions.forEach(({ _id, totalAmount }) => {
            transactionData[_id] = totalAmount || 0;
        });

        // Convert credit transactions into an object
        const creditTransactionData = {};
        creditTransactions.forEach(({ _id, totalAmount, totalBalance }) => {
            creditTransactionData[_id] = totalAmount || 0;
            creditTransactionData[_id + "_balance"] = totalBalance || 0
        });

        // Calculate Cash Equivalents
        data.cashEquivalents =
            (transactionData["Sale"] || 0) +
            (transactionData["Payment-In"] || 0) +
            (transactionData["bank_to_cash"] || 0) -
            (transactionData["Payment-Out"] || 0) -
            (transactionData["cash_to_bank"] || 0);

        // Accounts Receivable (Based on Credit Transactions Only)
        data.accountReceivable =
            (creditTransactionData["Sale_balance"] || 0) -
            (creditTransactionData["Credit Note_balance"] || 0) -
            (creditTransactionData["Payment-In_balance"] || 0);


        // Calculate Allowance for Doubtful Accounts (10% of A/R by default)
        data.allowanceForDoubtfulAccounts =
            estimatedDoubtfulPercentage * data.accountReceivable;


        //Fetching Opening Stock
        let ProductsData = await Products.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId)
                }
            },
            {
                $group: {
                    _id: null,
                    openingStockValue: { $sum: { $multiply: ["$stock.totalQuantity", "$purchasePrice"] } }
                }
            },
            {
                $project: {
                    openingStockValue: { $max: ["$openingStockValue", 0] }
                }
            }

        ]);

        const { openingStockValue = 0 } = ProductsData[0] || {};

        const purchaseSaleData = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: { $in: ["Purchase", "Sale"] }
                }
            },
            {
                $group: {
                    _id: "$transactionType",
                    totalAmount: { $sum: "$totalAmount" }
                }
            }
        ]);


        const { Purchase = 0, Sale = 0 } = Object.fromEntries(
            purchaseSaleData.map(({ _id, totalAmount }) => [_id, totalAmount])
        );


        const prepaidExpenses = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: { $in: ['Expense'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalPaid: { $sum: "$debit_amount" },
                    totalExpense: { $sum: "$totalAmount" }
                }
            },
            {
                $project: {
                    totalPaid: 1,
                    prepaidAmount: { $subtract: ["$totalPaid", "$totalExpense"] }
                }
            }
        ]);

        data.prepaidExpenses = prepaidExpenses.length > 0 && prepaidExpenses[0].prepaidAmount > 0
            ? prepaidExpenses[0].prepaidAmount
            : 0;

        data.inventory = openingStockValue + Purchase - Sale;

        return data;
    } catch (err) {
        throw new Error(err);
    }
};

const getCurrentLiabilities = async (userId, companyId) => {
    try {
        let data = {};

        // Accounts Payable (Unpaid Purchases)
        const accountsPayable = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: "Purchase",
                }
            },
            {
                $group: {
                    _id: null,
                    totalPurchases: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$debit_amount" },
                }
            },
            {
                $project: {
                    accountsPayable: { $subtract: ["$totalPurchases", "$totalPaid"] },
                }
            }
        ]);

        //Salaries Payable (Unpaid Salaries)
        const salariesPayable = await Expenses.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    expenseCategory: "Salary"
                }
            },
            {
                $group: {
                    _id: null,
                    totalExpense: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$paidAmount" },
                }
            },
            {
                $project: {
                    salariesPayable: { $subtract: ["$totalExpense", "$totalPaid"] },
                }
            }
        ]);

        //Unearned Revenue (Advance Received
        const unearnedRevenue = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: "Payment-In",
                }
            },
            {
                $group: {
                    _id: null,
                    totalReceived: { $sum: "$credit_amount" }
                }
            },
            {
                $project: {
                    unearnedRevenue: "$totalReceived"
                }
            }
        ]);

        const otherCurrentLiabilities = await Expenses.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    expenseCategory: { $ne: "Salary" } // Excluding salaries
                }
            },
            {
                $group: {
                    _id: null,
                    totalExpenses: { $sum: "$totalAmount" },
                    totalPaid: { $sum: "$paidAmount" },
                }
            },
            {
                $project: {
                    otherCurrentLiabilities: { $subtract: ["$totalExpenses", "$totalPaid"] },
                }
            }
        ]);

        data.accountsPayable = accountsPayable[0]?.accountsPayable || 0;
        data.salariesPayable = salariesPayable[0]?.salariesPayable || 0;
        data.unearnedRevenue = unearnedRevenue[0]?.unearnedRevenue || 0;
        data.otherCurrentLiabilities = otherCurrentLiabilities[0]?.otherCurrentLiabilities || 0;


        return data;
    } catch (error) {
        throw new Error(error);
    }
};


const getNonCurrentLiabilities = async (userId, companyId) => {
    try {
        let data = {};

        const taxLiability = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    "reference.docName": { $in: ["Invoice", "Purchase", "Credit Note", "Debit Note"] }
                }
            },
            {
                $lookup: {
                    from: "invoices", // Checking invoices collection
                    localField: "reference.documentId",
                    foreignField: "_id",
                    as: "invoiceData"
                }
            },
            {
                $lookup: {
                    from: "purchases", // Checking purchases collection
                    localField: "reference.documentId",
                    foreignField: "_id",
                    as: "purchaseData"
                }
            },
            {
                $lookup: {
                    from: "creditnotes", // Checking credit notes collection
                    localField: "reference.documentId",
                    foreignField: "_id",
                    as: "creditNoteData"
                }
            },
            {
                $lookup: {
                    from: "debitnotes", // Checking debit notes collection
                    localField: "reference.documentId",
                    foreignField: "_id",
                    as: "debitNoteData"
                }
            },
            {
                $project: {
                    taxAmounts: {
                        $concatArrays: [
                            { $ifNull: ["$invoiceData.items.taxAmount", []] },
                            { $ifNull: ["$purchaseData.items.taxAmount", []] },
                            { $ifNull: ["$creditNoteData.items.taxAmount", []] },
                            { $ifNull: ["$debitNoteData.items.taxAmount", []] }
                        ]
                    }
                }
            },
            {
                $unwind: "$taxAmounts"
            },
            {
                $group: {
                    _id: null,
                    totalTaxLiability: { $sum: "$taxAmounts" }
                }
            }
        ]);

        //This formula considers any long-standing unpaid purchases or expenses that were not settled.

        const otherNonCurrentLiabilities = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: { $in: ["Purchase", "Payment-Out"] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOtherLiabilities: { $sum: "$balance" }
                }
            }
        ]);

        data.taxLiability = taxLiability[0]?.totalTaxLiability || 0;
        data.otherNonCurrentLiabilities = otherNonCurrentLiabilities[0]?.totalOtherLiabilities || 0;


        return data;
    } catch (error) {
        throw new Error(error);
    }
};


//Revenue
const getOperatingRevenueData = async (userId, companyId) => {
    try {
        let data = {};

        // Calculate Sales Revenue (Sum of Invoice Total Amount)
        const salesRevenue = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: "Sale"
                }
            },
            {
                $group: {
                    _id: null,
                    totalSalesRevenue: { $sum: "$totalAmount" }
                }
            }
        ]);

        // Calculate Other Operating Revenue (Sum of Credit Note Total Amount)
        // Credit notes may represent refunds, adjustments, or returns that still contribute to revenue figures in some cases.
        const otherOperatingRevenue = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    "transationType": "Credit Note",
                }
            },
            {
                $group: {
                    _id: null,
                    totalCreditNotes: { $sum: "$totalAmount" }
                }
            }
        ]);

        data.salesRevenue = salesRevenue[0]?.totalSalesRevenue || 0;
        data.otherOperatingRevenue = otherOperatingRevenue[0]?.totalCreditNotes || 0;

        console.log(data, 'Revenue Data');

        return data;
    } catch (error) {
        throw new Error(error);
    }
};



//Expense


//COst of Good Sales

// Formula using
//COGS = Total Purchases + Direct Expenses - Closing Stock Value
const getCOGS = async (userId, companyId) => {
    try {
        let data = {};

        // Step 1: Get Total Purchases
        const totalPurchases = await Transactions.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                    transactionType: "Purchase"
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$totalAmount" }
                }
            }
        ]);

        // Get Direct Expenses (if applicable)
        // const directExpenses = await Expenses.aggregate([
        //     {
        //         $match: {
        //             createdBy: new mongoose.Types.ObjectId(userId),
        //             "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
        //             expenseCategory: { $in: ["Freight", "Shipping", "Customs", "Other Direct Costs"] }
        //         }
        //     },
        //     {
        //         $group: {
        //             _id: null,
        //             totalExpense: { $sum: "$totalAmount" }
        //         }
        //     }
        // ]);

        //Get Closing Stock Value from Products
        const closingStock = await Products.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(userId),
                    "companyDetails.companyId": new mongoose.Types.ObjectId(companyId)
                }
            },
            {
                $project: {
                    stockValue: { $multiply: ["$stock.totalQuantity", "$purchasePrice"] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalStockValue: { $sum: "$stockValue" }
                }
            }
        ]);

        // Compute COGS
        const purchases = totalPurchases[0]?.totalAmount || 0;
        // const expenses = directExpenses[0]?.totalExpense || 0;
        const stock = closingStock[0]?.totalStockValue || 0;

        // data.COGS = purchases + expenses - stock;

        data.COGS = purchases - stock;

        console.log(data, 'Cost of Goods Sold');

        return data;
    } catch (error) {
        throw new Error(error);
    }
};



//Operatng Expense
const getOperatingExpenses = async (userId, companyId) => {
    const expenseCategories = {
        salaries: /salary|payroll/i,
        rent: /rent/i,
        depreciation: /depreciation/i,
        utilities: /electricity|water|internet|utilities/i,
        marketing: /marketing|advertisement|promotion/i,
        other: /(miscellaneous|other)/i
    };

    return await Expenses.aggregate([
        {
            $match: {
                "companyDetails.companyId": new mongoose.Types.ObjectId(companyId),
                createdBy: new mongoose.Types.ObjectId(userId),
                expenseCategory: { $exists: true, $ne: "" }
            }
        },
        {
            $group: {
                _id: {
                    $switch: {
                        branches: [
                            { case: { $regexMatch: { input: "$expenseCategory", regex: expenseCategories.salaries } }, then: "Salaries Expense" },
                            { case: { $regexMatch: { input: "$expenseCategory", regex: expenseCategories.rent } }, then: "Rent Expense" },
                            { case: { $regexMatch: { input: "$expenseCategory", regex: expenseCategories.depreciation } }, then: "Depreciation Expense" },
                            { case: { $regexMatch: { input: "$expenseCategory", regex: expenseCategories.utilities } }, then: "Utilities Expense" },
                            { case: { $regexMatch: { input: "$expenseCategory", regex: expenseCategories.marketing } }, then: "Marketing Expense" }
                        ],
                        default: "Other Operating Expenses"
                    }
                },
                totalAmount: { $sum: "$totalAmount" }
            }
        }
    ]);
};

exports.generateTrialBalanceReport = async (req, res) => {
    try {
        let currentAssets = await getCurrentAssets(req.user, req.companyId);
        let currentLiabilities = await getCurrentLiabilities(req.user, req.companyId);
        let nonCurrentLiabilities = await getNonCurrentLiabilities(req.user, req.companyId);
        let operatingRevenueData = await getOperatingRevenueData(req.user, req.companyId);
        // Non-Operating Revenue not applicable for now
        //Expense
        let COGSValue = await getCOGS(req.user, req.companyId);
        let operatingExpense = await getOperatingExpenses(req.user, req.companyId);
        // Non-Operating Expenses is not applicable in our system 


        res.status(200).json({ currentAssets, currentLiabilities, nonCurrentLiabilities, operatingRevenueData, COGSValue, operatingExpense });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const Sales = require('../../models/invoiceModel');
const Purchase = require('../../models/purchase/purchaseModel');
const Transactions = require('../../models/transactionModel');
const mongoose = require('mongoose');

exports.getDiscountReport = async (req, res) => {
    try {

        const { fromDate, toDate } = req.query;
        if (!fromDate || !toDate) {
            return res.status(400).json({ status: 'Failed', message: "fromDate and toDate are required" })
        }

        // Convert to date objects and format if needed
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);


        // Ensure that endDate includes the full day by setting the time to 23:59:59
        endDate.setHours(23, 59, 59, 999);

        const SalesData = await Sales.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
                    invoiceDate: {
                        $gte: startDate,
                        $lte: endDate 
                    }
                }
            },
            {
                $unwind: '$items'  
            },
            {
                $addFields: {
                    totalAmount: {
                        $multiply: ['$items.price', '$items.quantity'] 
                    },
                    discountAmount: {
                        $multiply: [
                            { $divide: ['$items.discountPercent', 100] }, 
                            { $multiply: ['$items.price', '$items.quantity'] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$party', 
                    saleDiscount: { $sum: '$discountAmount' },
                    partyName: { $first: '$partyName' }
                }
            },
            {
                $project: {
                    _id: 0,
                    party: '$_id',
                    saleDiscount: 1,
                    partyName: 1
                }
            }
        ]);



        const PurchaseData = await Purchase.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
                    billDate: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $unwind: '$items'
            },

            {
                $addFields: {
                    totalAmount: {
                        $multiply: ['$items.price', '$items.quantity']
                    },
                    discountAmount: {
                        $multiply: [
                            { $divide: ['$items.discountPercent', 100] }, 
                            { $multiply: ['$items.price', '$items.quantity'] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$party',  // Group by party
                    purchaseDiscount: { $sum: '$discountAmount' },
                    partyName: { $first: '$partyName' } 
                }
            },
            {
                $project: {
                    _id: 0,
                    party: '$_id',
                    purchaseDiscount: 1,
                    partyName: 1
                }
            }
        ]);

        const combinedData = [...PurchaseData, ...SalesData];

        const mergedData = combinedData.reduce((acc, curr) => {
            const existingParty = acc.find(item => item.party.equals(curr.party));

            if (existingParty) {
                // If the party already exists, merge discounts
                existingParty.purchaseDiscount = existingParty.purchaseDiscount || curr.purchaseDiscount || 0;
                existingParty.saleDiscount = existingParty.saleDiscount || curr.saleDiscount || 0;
            } else {
                // If the party doesn't exist, add a new entry
                acc.push({
                    partyName: curr.partyName,
                    party: curr.party,
                    purchaseDiscount: curr.purchaseDiscount || 0,
                    saleDiscount: curr.saleDiscount || 0
                });
            }

            return acc;
        }, []);

        const totalSaleDiscount = mergedData.reduce((sum, item) => sum + (item.saleDiscount || 0), 0);
        const totalPurchaseDiscount = mergedData.reduce((sum, item) => sum + (item.purchaseDiscount || 0), 0);

        res.status(200).json({
            status: 'Successfully Retrieved Discount Report',
            totalSaleDiscount,
            totalPurchaseDiscount,
            data: mergedData
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error", error: error.message || error })
    }
}
const Purchase = require("../../../models/purchase/purchaseModel");
const mongoose = require('mongoose');

exports.fetchPurchaseWithTaxReport = async (req, res) => {
    try {

        let { fromDate, toDate } = req.query;

        if (!fromDate || !toDate) {
            res.status(400).json({ status: "Failed", message: "From and to Date are required." });
        };

        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);

        endDate.setHours(23, 59, 59, 999);

        let searchConditions = {
            createdBy: new mongoose.Types.ObjectId(req.user),
            'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
            billDate: {
                $gte: startDate,
                $lte: endDate
            }
        };

        let PurchaseData = await Purchase.aggregate([
            {
                $match: searchConditions
            },
            {
                $unwind: '$items'
            },
            {
                $lookup: {
                    from: 'parties',
                    localField: "party",
                    foreignField: "_id",
                    as: "partyDetails"
                }
            },
            {
                $lookup: {
                    from: 'taxrates',
                    localField: "items.taxPercent",
                    foreignField: '_id',
                    as: 'taxPercentage'
                }
            },
            {
                $unwind: {
                    path: "$taxPercentage",
                    preserveNullAndEmptyArrays: true  //For Now, Allowing null tax percentages here
                }
            },
            {
                $group: {
                    _id: '$_id',
                    billNo: { $first: '$billNo' },
                    billDate: { $first: '$billDate' },
                    partyName: { $first: '$partyName' },
                    taxableAmount: {
                        $sum: {
                            $subtract: [
                                { $multiply: ["$items.price", "$items.quantity"] },
                                { $multiply: ["$items.price", "$items.quantity", { $divide: ["$items.discountPercent", 100] }] }
                            ]
                        }
                    },
                    taxAmount: { $sum: '$items.taxAmount' },
                    taxPercent: { $first: '$taxPercentage.rate' },
                    partyDetails: { $first: '$partyDetails' },
                }
            },
            {
                $project: {
                    _id: 1,
                    billNo: 1,
                    billDate: { $dateToString: { format: "%d-%m-%Y", date: "$billDate" } },
                    partyName: '$partyName',
                    taxRegistrationNo: { $first: '$partyDetails.gstIn' },
                    taxableAmount: 1,
                    taxAmount: 1,
                    taxPercent: { $ifNull: ["$taxPercent", 0] },
                }
            }
        ]);

        PurchaseData=PurchaseData.sort((a,b)=>a.billDate-b.billDate);

        res.status(200).json({ message: 'Purchase with Tax Report Fetched Successfully', data: PurchaseData });

    } catch (error) {
        res.status(500).json({ error: error.message || error });
    };
};
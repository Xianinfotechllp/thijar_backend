const SaleReturns = require("../../../models/crnModel");
const mongoose = require("mongoose");

exports.fetchSalesReturnWithTaxReport = async (req, res) => {
    try {
        let { fromDate, toDate } = req.query;

        if (!fromDate || !toDate) {
            return res
                .status(400)
                .json({ status: "Failed", message: "From and to Date are required." });
        }

        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);

        let searchConditions = {
            createdBy: new mongoose.Types.ObjectId(req.user),
            "companyDetails.companyId": new mongoose.Types.ObjectId(req.companyId),
            date: { $gte: startDate, $lte: endDate },
        };

        let SaleReturnData = await SaleReturns.aggregate([
            { $match: searchConditions },
            { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "parties",
                    localField: "party",
                    foreignField: "_id",
                    as: "partyDetails",
                },
            },
            {
                $lookup: {
                    from: "taxrates",
                    localField: "items.taxPercent",
                    foreignField: "_id",
                    as: "taxPercentage",
                },
            },
            { $unwind: { path: "$taxPercentage", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: "$_id",
                    returnNo: { $first: "$returnNo" },
                    date: { $first: "$date" },
                    partyName: { $first: "$partyName" },
                    taxableAmount: {
                        $sum: {
                            $cond: {
                                if: { $isArray: "$items" },
                                then: {
                                    $subtract: [
                                        { $multiply: ["$items.price", "$items.quantity"] },
                                        {
                                            $multiply: [
                                                "$items.price",
                                                "$items.quantity",
                                                { $divide: ["$items.discountPercent", 100] },
                                            ],
                                        },
                                    ],
                                },
                                else: 0,
                            },
                        },
                    },
                    taxAmount: { $sum: { $ifNull: ["$items.taxAmount", 0] } },
                    taxPercent: { $first: "$taxPercentage.rate" },
                    partyDetails: { $first: "$partyDetails" },
                },
            },
            {
                $project: {
                    _id: 1,
                    returnNo: 1,
                    date: { $dateToString: { format: "%d-%m-%Y", date: "$date" } },
                    taxRegistrationNo: { $ifNull: [{ $first: "$partyDetails.gstIn" }, ""] },
                    taxableAmount: 1,
                    taxAmount: 1,
                    taxPercent: { $ifNull: ["$taxPercent", 0] },
                },
            },
        ]);

        let CrnWithNoItems = await SaleReturns.aggregate([
            {
                $match: {
                    ...searchConditions,
                    items: { $size: 0 },
                },
            },
            {
                $lookup: {
                    from: "parties",
                    localField: "party",
                    foreignField: "_id",
                    as: "partyDetails",
                },
            },
            {
                $addFields: {
                    taxableAmount: 0,
                    taxAmount: 0,
                    taxPercent: 0,
                },
            },
            {
                $project: {
                    _id: 1,
                    returnNo: 1,
                    date: { $dateToString: { format: "%d-%m-%Y", date: "$date" } },
                    partyName: 1,
                    taxRegistrationNo: { $ifNull: [{ $first: "$partyDetails.gstIn" }, ""] },
                    taxableAmount: 1,
                    taxPercent: 1,
                    taxAmount: 1,
                },
            },
        ]);

        SaleReturnData = SaleReturnData.concat(CrnWithNoItems).sort(
            (a, b) => a.returnNo - b.returnNo
        );

        return res
            .status(200)
            .json({
                message: "Sale-Return with Tax Report Fetched Successfully",
                data: SaleReturnData,
            });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || error });
    }
};

const StockTransfers = require("../../../models/stockTransfer/stockTransferModel");
const mongoose = require("mongoose");
const formatDate = require("../../../global/formatDate");
const Categories = require("../../../models/categoryModel");

exports.fetchStockTranferReport = async (req, res) => {
    try {
        const { fromDate, toDate, category, search } = req.query;

        if (!fromDate || !toDate) {
            return res
                .status(400)
                .json({ status: "Failed", message: "fromDate and toDate are required." });
        }

        // Convert to date objects
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);

        // Base match conditions
        const matchConditions = {
            transferDate: { $gt: startDate, $lt: endDate },
            createdBy: new mongoose.Types.ObjectId(req.user),
            "companyDetails.companyId": new mongoose.Types.ObjectId(req.companyId),
        };
        let categoryId;

        if (category && category !== "All") {
            // if (category.toUpperCase().trim() === "UNCATEGORIZED")
            //     matchConditions.category = [];
            // else {

            categoryId = await fetchCategoryName(category, req.user, req.companyId);

            if (!categoryId) {
                return res.status(400).json({ message: "Category Not Found" });
            };

            // matchConditions.category = {
            //     $in: [categoryId],
            // };
            // }
        };

        const pipeline = [
            { $match: matchConditions },
            {
                $lookup: {
                    from: "godowns",
                    localField: "fromGodown",
                    foreignField: "_id",
                    as: "fromGodownDetails",
                },
            },
            {
                $lookup: {
                    from: "godowns",
                    localField: "toGodown",
                    foreignField: "_id",
                    as: "toGodownDetails",
                },
            },
            {
                $addFields: {
                    fromGodownName: { $arrayElemAt: ["$fromGodownDetails.name", 0] },
                    toGodownName: { $arrayElemAt: ["$toGodownDetails.name", 0] },
                },
            },
            {
                $project: {
                    fromGodownDetails: 0,
                    toGodownDetails: 0,
                },
            },
        ];

        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { fromGodownName: { $regex: search, $options: "i" } },
                        { toGodownName: { $regex: search, $options: "i" } },
                    ],
                },
            });
        }

        if (category) {

            pipeline.push({
                $unwind: "$items"
            });

            pipeline.push({
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "itemDetails",
                },
            });

            pipeline.push({
                $unwind: "$itemDetails"
            });

            pipeline.push({
                $match: { "itemDetails.category": { $in: [categoryId] } }
            });
        }

        const transfers = await StockTransfers.aggregate(pipeline);

        for (const transfer of transfers) {
            transfer.transferDate = formatDate(transfer.transferDate);
        };

        res.status(200).json({
            success: true,
            data: transfers,
        });
    } catch (error) {
        res
            .status(500)
            .json({ message: "Internal Server Error", error: error.message || error });
    }
};



const fetchCategoryName = async (category, userId, companyId) => {
    const CategoryDetails = await Categories.findOne({ name: category, createdBy: userId, "companyDetails.companyId": companyId });

    return CategoryDetails?._id;
};
const Products = require("../../models/productModel");
const StockTransfers = require("../../models/stockTransfer/stockTransferModel");
const Godowns = require("../../models/stockTransfer/godownModel");
const mongoose = require('mongoose');
const formatDate = require('../../global/formatDate');

exports.getAllStockTransfers = async (req, res) => {
    try {

        let allStockTransfers = await StockTransfers.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId)
                }
            },
            {
                $lookup: {
                    from: "godowns",
                    localField: "fromGodown",
                    foreignField: "_id",
                    as: "fromGodownDetails",
                    pipeline: [{
                        $project: {
                            name: 1
                        }
                    }]
                }
            },
            {
                $lookup: {
                    from: "godowns",
                    localField: "toGodown",
                    foreignField: "_id",
                    as: "toGodownDetails",
                    pipeline: [{
                        $project: {
                            name: 1
                        }
                    }]
                }
            },
            {
                $project: {
                    _id: 1,
                    transferDate: { $dateToString: { format: "%d-%m-%Y", date: "$transferDate" } },
                    fromGodownDetails: '$fromGodownDetails',
                    toGodownDetails: '$toGodownDetails',
                    totalItems: { $size: '$items' },
                    totalQuantity: 1
                }
            }
        ]);


        return res.status(200).json({ message: "All Stock Transfers Fetched Successfully", data: allStockTransfers });

    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
}

exports.transferStock = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let { transferDate, fromGodown, toGodown, items } = req.body;

        let fromGodownId;
        let toGodownId;
        let totalQuantity = 0;

        if (!transferDate || !fromGodown || !toGodown || !items) {
            return res.status(400).json({ message: "All Field are Required" });
        };

        // check if godowns exists
        let fromGodownDetails = await Godowns.findOne({ name: fromGodown, createdBy: req.user, companyId: req.companyId }).session(session);

        if (!fromGodownDetails) {
            return res.status(404).json({ message: `${fromGodown} is  Not Found` });
        };

        let toGodownDetails = await Godowns.findOne({ name: toGodown, createdBy: req.user, companyId: req.companyId }).session(session);

        if (!toGodownDetails) {
            return res.status(404).json({ message: `${toGodown} is Not Found` });
        };

        fromGodownId = fromGodownDetails._id;
        toGodownId = toGodownDetails._id;

        // items = items ? JSON.parse(items) : [];

        if (items.length <= 0) {
            return res.status(400).json({ message: "Please Select Items for Stock Transfer" });
        };

        for (let item of items) {
            if (!item.productId || !item.quantity || item.quantity <= 0)
                return res.status(400).json({ status: 'Failed', message: "Items Validation Failed...ProductId and quantity are required." });

            totalQuantity = totalQuantity + item.quantity;

            // check if product exists
            let productDetails = await Products.findOne({ _id: item.productId, createdBy: req.user, 'companyDetails.companyId': req.companyId }).session(session);

            if (!productDetails) return res.status(404).json({ status: 'Failed', message: "Product Not Found" });

            //Deducting Quantity From source Godown
            await Products.updateOne(
                { _id: item.productId, "godownStock.godownId": fromGodownId },
                { $inc: { "godownStock.$.quantity": -item.quantity } },
                { session }
            );

            //Adding Quantity to Destination Godown
            await Products.updateOne(
                { _id: item.productId, "godownStock.godownId": toGodownId },
                { $inc: { "godownStock.$.quantity": item.quantity } },
                { upsert: true, session }
            );
        };

        const StockTransferEntry = await StockTransfers.create([{ transferDate, fromGodown: fromGodownId, toGodown: toGodownId, items, totalQuantity, 'companyDetails.companyId': req.companyId, createdBy: req.user }], { session });

        await session.commitTransaction();
        res.status(201).json({ message: "Stock Transfer Completed Successfully", data: StockTransferEntry });
    } catch (error) {
        console.log(error)
        await session.abortTransaction();
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
        // throw error;
    } finally {
        session.endSession();
    }
};


exports.getStockTransferById = async (req, res) => {
    try {

        let stockTransferId = req.params.id;

        if (!stockTransferId) return res.status(400).json({ status: "Failed", message: "Enter Valid Id" });

        let stockTransfersDetails = await StockTransfers.findOne({ _id: stockTransferId, createdBy: req.user, 'companyDetails.companyId': req.companyId }).populate('fromGodown', 'name').populate('toGodown', 'name').populate('items.productId','itemName  itemCode').select('-__v -updatedAt -companyDetails  -createdBy');

        if (!stockTransfersDetails) return res.status(404).json({ message: "Stock Transfer Not Found", data: [] });
       
        stockTransfersDetails.transferDate = formatDate(stockTransfersDetails.transferDate);


        res.status(200).json({ message: `Stock Transfer Details Fetched Successfully for id : ${stockTransferId}`, data: stockTransfersDetails });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
}

exports.getStockDataForGodown = async (req, res) => {
    try {

        let godownId = req.params.godownId;


        let godownDetails = await Godowns.findOne({ _id: godownId, createdBy: req.user, companyId: req.companyId });

        if (!godownDetails) {
            return res.status(404).json({ message: "Godown Not Found" });
        }
        let stockDetails = await Products.aggregate([
            {
                $match: {
                    createdBy: new mongoose.Types.ObjectId(req.user),
                    'companyDetails.companyId': new mongoose.Types.ObjectId(req.companyId),
                }
            },
            {
                $unwind: '$godownStock'
            },
            {
                $match: {
                    'godownStock.godownId': new mongoose.Types.ObjectId(godownId)
                }
            },
            {
                $addFields: {
                    availableQuantity: {
                        $cond: {
                            if: {
                                $eq: [{ $type: '$godownStock' }, 'object']
                            },
                            then: '$godownStock.quantity',
                            else: 0
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    itemName: 1,
                    itemCode: 1,
                    availableQuantity: 1,
                }
            }
        ]);


        res.status(200).json({ status: "Success", data: stockDetails });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
}








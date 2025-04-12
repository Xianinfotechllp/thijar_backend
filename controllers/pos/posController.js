const PosInvoice = require("../../models/pos/posInvoice.model");
const Transactions = require("../../models/transactionModel");
const SeriesNumber = require("../../models/seriesnumber");
const Products = require("../../models/productModel");
const Units = require("../../models/unitModel");
const Categories = require("../../models/categoryModel");
const Banks = require("../../models/bankModel")
const mongoose = require("mongoose");


exports.getAllPOSInvoices = async (req, res) => {
    try {

        const { fromDate, toDate } = req.query;
        let searchConditions = {
            createdBy: req.user,
            "companyDetails.companyId": req.companyId,
        };

        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);

            fromDate == toDate ? endDate.setDate(endDate.getDate() + 1) : "";
            searchConditions.date = { $gte: startDate, $lte: endDate };
        };

        let POSData = await PosInvoice.find(searchConditions).lean().select("-__v -companyDetails -createdBy");

        res.json({ message: "Success", data: POSData });
    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error",
            error: err.message || err,
        });
    }
}

exports.getPOSInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;

        const posInvoice = await PosInvoice.findOne({
            _id: id,
            createdBy: req.user,
            "companyDetails.companyId": req.companyId
        })
            .populate("items.itemId", "name price taxRate").select("-createdBy -companyDetails")
            .lean();

        if (!posInvoice) {
            return res.status(404).json({ status: "Failed", message: "POS Invoice Not Found!" });
        };

        res.status(200).json({ status: "Success", data: posInvoice });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    }
};


exports.getProductsForPos = async (req, res) => {
    try {

        const { category, skip, limit, } = req.query;

        let searchConditions = {
            createdBy: req.user,
            "companyDetails.companyId": req.companyId,
            type: "Product"
        };

        if (category) {
            let categoryId = await fetchCategoryId(category, req.user, req.companyId);

            if (!categoryId) {
                return res.status(404).json({ status: "Failed", message: "Category Not Found!" })
            };

            searchConditions.category = { $in: [categoryId.toString()] };
        };

        const ItemsList = await Products.find(searchConditions)
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .select("image itemName unit salePrice category taxRate")
            .populate("category", "name")
            // .populate({
            //     path: "unit",
            //     select: "name shortName conversionReferences",
            //     populate: {
            //         path: "conversionReferences",
            //         select: "baseUnit secondaryUnit",
            //         populate: [
            //             {
            //                 path: "baseUnit",
            //                 select: "name shortName"
            //             },
            //             {
            //                 path: "secondaryUnit",
            //                 select: "name shortName"
            //             }
            //         ]
            //     }
            // })
            .populate({
                path: "unitConversion",
                select: "baseUnit secondaryUnit conversionRate",
                populate: [
                    { path: "baseUnit", select: "name shortName" },
                    { path: "secondaryUnit", select: "name shortName" },
                ],
            })
            .lean();

        res.status(200).json({ status: "Success", data: ItemsList });
    } catch (err) {
        res.status(500).json({
            message: "Internal Server Error",
            error: err.message || err,
        });
    }
};


exports.getPOSInvoiceNo = async (req, res) => {
    try {
        let data = await SeriesNumber.findOne({
            createdBy: req.user,
            "companyDetails.companyId": req.companyId,
        }).select("posInvoiceNo");

        if (!data) {
            return res.status(200).json({ error: "Data not Found!!!!" });
        };

        data = {
            _id: data._id,
            posInvoiceNo: `${req?.prefix ? req.prefix + "-" : ""}${data.posInvoiceNo}`,
        };

        res.status(200).json({ status: "Success", data: data });
    } catch (error) {
        res.status(500).json({
            message: "Internal Server Error",
            error: error.message || error,
        });
    }
};

const fetchBankId = async (bankName, userId, companyId) => {
    let BankDetails = await Banks.findOne({ bankName, createdBy: userId, 'companyDetails.companyId': companyId });

    return BankDetails._id.toString();
}

exports.createInvoice = async (req, res) => {

    const session = await mongoose.startSession();
    session.startTransaction();
    try {

        let { invoiceType, invoiceNo, bankName, date, mode, phoneNo, card, user, customerName, phone, items, taxableAmount, taxAmount, totalAmount, rewards, discount } = req.body;


        console.log(req.body, 'Request Body for Pos ');
        bankName = mode.toLowerCase() === "Bank" ? await fetchBankId(bankName, req.user, req.companyId) : null;


        if (mode.toLowerCase() == "bank" && !bankName) {
            res.status(404).json({ status: "Failed", message: "Bank is not found" });
        };


        invoiceType = !invoiceType ? "sale" : "sale-return";

        const isInvoiceNoExists = await PosInvoice.findOne({
            invoiceNo,
            createdBy: req.user,
            "companyDetails.companyId": req.companyId,
        });

        if (isInvoiceNoExists) {
            return res
                .status(409)
                .json({ status: "Failed", message: "This Invoice No. already Exists!!" });
        }


        let totalQty = 0;
        items.forEach((item) => {
            totalQty += item.qty;
            // totalAmount += item.qty * item.price;
        });


        items = Array.isArray(items)
            ? await processPosItems(items, req.user, req.companyId, session) : [];


        // Create new POS invoice
        const newPosInvoice = new PosInvoice({
            invoiceType,
            invoiceNo,
            date,
            mode,
            bankName,
            phone: phoneNo,
            card,
            customerName,
            phone,
            user,
            items,
            totalQty,
            taxableAmount,
            taxAmount,
            rewards,
            totalDiscount: discount,
            totalAmount,
            createdBy: req.user,
            "companyDetails.companyId": req.companyId
        });

        await newPosInvoice.save({ session });

        // Prepare transaction reference
        const transactionReference = {
            documentId: newPosInvoice._id,
            documentNumber: invoiceNo,
            docName: "posinvoices",
        };

        // Map POS mode to paymentMethod format
        const paymentMethod = [
            {
                method: mode,
                amount: totalAmount,
            },
        ];

        console.log(paymentMethod, "Payment Method");

        // Create the transaction document
        const savedTransaction = await Transactions.create(
            [
                {
                    transactionType: "POS",
                    totalAmount,
                    totalDiscount: +discount,
                    party: null,
                    credit_amount: totalAmount,
                    balance: 0,
                    description: "",
                    reference: transactionReference,
                    paymentMethod,
                    createdBy: req.user,
                    "companyDetails.companyId": req.companyId,
                },
            ],
            { session }
        );

        let getLatestPosInvoiceNo = await SeriesNumber.findOne(
            { createdBy: req.user, "companyDetails.companyId": req.companyId },
            "posInvoiceNo",
            { session }
        );

        if (!getLatestPosInvoiceNo) {
            throw new Error("SeriesNumber record not found");
        };

        if (+invoiceNo >= getLatestPosInvoiceNo.posInvoiceNo) {
            const updatedSeries = await SeriesNumber.findOneAndUpdate(
                { createdBy: req.user, "companyDetails.companyId": req.companyId },
                { posInvoiceNo: +invoiceNo + 1 },
                { new: true, session }
            );

            if (!updatedSeries) {
                throw new Error("Failed to update series value");
            }
        }



        console.log(items, 'Items')
        // //Updating Stock Quantity in items
        for (const item of items) {
            const { itemId, qty } = item;

            // Using findOneAndUpdate directly
            const updatedProduct = await Products.findOneAndUpdate(
                {
                    _id: itemId,
                    type: "Product",
                    createdBy: req.user,
                    "companyDetails.companyId": req.companyId,
                    // "godownStock.godownId": godown
                },
                {
                    $inc: {
                        "stock.saleQuantity": qty,
                        "stock.totalQuantity": -qty,
                        //   "godownStock.$.quantity": -quantity,
                    },
                    // $inc: {
                    //   "godownStock.$.quantity": -quantity,
                    // },
                },
                { new: true, session }
            );

            if (!updatedProduct) {
                throw new Error(
                    `Failed to update product with itemId ${itemId}. Product not found.`
                );
            } else {
                console.log(`Updated Product`);
            }
        }

        await session.commitTransaction()

        res.status(201).json({ success: true, posInvoice: newPosInvoice });

    } catch (error) {
        console.log(error)
        await session.abortTransaction()
        res.status(500).json({ message: "Internal Server Error", error: error.message || error })
    }
    finally {
        session.endSession()
    };
};





const processPosItems = async (items, userId, companyId, session) => {
    try {
        for (const item of items) {
            // Checking if the unit exists or not
            let existingUnit = await Units.findOne({ name: item.unit, createdBy: userId, 'companyDetails.companyId': companyId });

            if (!existingUnit) {
                console.log(`Unit Not Found for ${item.unit}`);
                throw new Error('Unit not found');
            } else {
                item.unit = existingUnit._id;
            };

            // Checking if the item exists (if not, create a new one)
            let existingItem = await Products.findOne({
                itemName: { $regex: new RegExp("^" + item.name + "$", "i") },
                createdBy: userId,
                'companyDetails.companyId': companyId
            });

            if (!existingItem) {
                console.log(`Item not found in POS: ${item.name}`);
                throw new Error(`Item not Found -${item.name}`);

            } else {
                item.itemId = existingItem._id;

            }

            delete item.name;
        }

        return items;
    } catch (error) {
        console.error('Error processing items:', error);
        throw new Error('Error processing items:' + error);
    }
};




const fetchCategoryId = async (categoryName, userId, companyId) => {
    if (!categoryName) return null;

    try {
        const category = await Categories.findOne({
            name: categoryName,
            createdBy: userId,
            "companyDetails.companyId": companyId
        }).select("_id");

        return category ? category._id : null;
    } catch (error) {
        console.error("Error fetching category ID:", error);
        return null;
    };
};
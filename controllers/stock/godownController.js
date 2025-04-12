const Godown = require("../../models/stockTransfer/godownModel");
const mongoose = require("mongoose");
const Products = require("../../models/productModel");
const StockTransfers = require("../../models/stockTransfer/stockTransferModel");

const getStockTransfersForGodown = async (req, res) => {
  try {
    let godownId = req.params.id;

    if (!godownId) {
      return res.status(400).json({ message: "Godown Id is required" });
    }

    let data = await StockTransfers.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(req.user),
          "companyDetails.companyId": new mongoose.Types.ObjectId(
            req.companyId
          ),
          $or: [
            { fromGodown: new mongoose.Types.ObjectId(godownId) },
            { toGodown: new mongoose.Types.ObjectId(godownId) },
          ],
        },
      },
      {
        $lookup: {
          from: "godowns",
          localField: "fromGodown",
          foreignField: "_id",
          as: "fromGodownDetails",
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "godowns",
          localField: "toGodown",
          foreignField: "_id",
          as: "toGodownDetails",
          pipeline: [
            {
              $project: {
                name: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          transferDate: {
            $dateToString: { format: "%d-%m-%Y", date: "$transferDate" },
          },
          fromGodownDetails: "$fromGodownDetails",
          toGodownDetails: "$toGodownDetails",
          totalItems: { $size: "$items" },
          items: 1,
          totalQuantity: 1,
        },
      },
    ]);

    return res.status(200).json({
      message: "All Stock Transfers Fetched  for given Godown Successfully ",
      data,
    });
  } catch (error) {
    console.error("Error Fetching Stock Transfers for  godown:", error);
    res.status(500).json({
      message: "Failed to create godown",
      error: error.message || error,
    });
  }
};

const addGodown = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { type, name, phoneNo, email, location, gstIn, pinCode, address } =
      req.body;

    if (typeof name === "string" && name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (typeof phoneNo !== "string" || phoneNo.trim().length === 0) {
      return res.status(400).json({ message: "Phone Number is required" });
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNo)) {
      return res.status(400).json({ message: "Invalid Phone Number" });
    }

    if (typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({ message: "Email is required" });
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid Email" });
    }

    let checkGodownExists = await Godown.findOne({
      name,
      createdBy: req.user,
      companyId: req.companyId,
    }).session(session);

    if (checkGodownExists) {
      return res
        .status(409)
        .json({ message: "Godown with this name already Exists" });
    }

    // Determine isMain based on type
    const isMain = type === "Main";

    const newGodown = new Godown({
      isMain,
      type,
      name,
      phoneNo,
      email,
      location,
      gstIn,
      pinCode,
      address,
      companyId: req.companyId,
      createdBy: req.user,
    });

    await newGodown.save({ session });

    //Adding this Godown in all Products created By the user and company Id
    await Products.updateMany(
      {
        "godownStock.godownId": { $ne: newGodown._id },
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      }, // Avoid adding if already exists
      { $push: { godownStock: { godownId: newGodown._id, quantity: 0 } } },
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      message: "Godown Created successfully",
      data: newGodown,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error adding godown:", error);
    res.status(500).json({
      message: "Failed to create godown",
      error: error.message || error,
    });
  } finally {
    session.endSession();
  }
};

const editGodown = async (req, res) => {
  try {
    const godownId = req.params.id;
    const { type, name, phoneNo, email, location, gstIn, pinCode, address } =
      req.body;

    if (typeof name === "string" && name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (typeof phoneNo !== "string" || phoneNo.trim().length === 0) {
      return res.status(400).json({ message: "Phone Number is required" });
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNo)) {
      return res.status(400).json({ message: "Invalid Phone Number" });
    }

    if (typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({ message: "Email is required" });
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid Email" });
    }

    const isMain = type === "Main";

    // Find the godown and update it

    let test = await Godown.findById(godownId);
    const updatedGodown = await Godown.findByIdAndUpdate(
      godownId,
      {
        type,
        name,
        phoneNo,
        email,
        location,
        gstIn,
        pinCode,
        address,
        companyId: req.companyId,
        updatedAt: Date.now(),
      },
      { new: true }
    );

    if (!updatedGodown) {
      return res.status(404).json({ message: "Godown not found" });
    }

    res.status(200).json({
      message: "Godown updated successfully",
      data: updatedGodown,
    });
  } catch (error) {
    console.error("Error editing godown:", error);
    res
      .status(500)
      .json({ message: "Failed to update godown", error: error.message });
  }
};

const getGodownDetailsById = async (req, res) => {
  try {
    const godownId = req.params.id;

    const godown = await Godown.findOne({
      _id: godownId,
      createdBy: req.user,
      companyId: req.companyId,
    });

    if (!godown) {
      return res.status(404).json({ message: "Godown not found" });
    }

    res.status(200).json({
      message: "Godown fetched successfully",
      data: godown,
    });
  } catch (error) {
    console.error("Error fetching godown:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch godown", error: error.message });
  }
};

const getAllGodowns = async (req, res) => {
  try {
    const godowns = await Godown.find({
      companyId: req.companyId,
      createdBy: req.user,
    }).select("-__v -createdAt -createdBy -companyId -updatedAt");

    if (!godowns.length) {
      return res.status(404).json({ message: "No godowns found" });
    }

    res.status(200).json({
      message: "Godowns fetched successfully",
      data: godowns,
    });
  } catch (error) {
    console.error("Error fetching godowns:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch godowns", error: error.message });
  }
};

const deleteGodown = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const godownId = req.params.id;

    if (!godownId) {
      return res.status(400).json({ message: "Godown Id is required" });
    }

    // Remove stock entries from products
    await Products.updateMany(
      {
        "godownStock.godownId": godownId,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      { $pull: { godownStock: { godownId: godownId } } },
      { session }
    );

    //Another functionality remaining for reverting all the stock transfers for this godown.Will do it later
    //reverting and deleting all Stock transfers for this godown
    //if this godown is froGodown  in stockTransfer then it should be reverted to mainGodown
    //if this godown is toGodown in stockTransfer then it should be reverted back to fromGodown of current Transfer

    // Handle stock transfers involving this godown
    const stockTransfers = await StockTransfers.find({
      $or: [{ fromGodown: godownId }, { toGodown: godownId }],
      "companyDetails.companyId": req.companyId,
    }).session(session);

    // Find main godown for reversion
    const mainGodown = await Godown.findOne({
      isMain: true,
      companyId: req.companyId,
    }).session(session);

    for (const transfer of stockTransfers) {
      for (const item of transfer.items) {
        if (transfer.fromGodown.equals(godownId)) {
          // If this godown was the source, revert stock to main godown
          await Products.updateOne(
            { _id: item.productId },
            { $inc: { "godownStock.$[elem].quantity": item.quantity } },
            { arrayFilters: [{ "elem.godownId": mainGodown._id }], session }
          );
        } else if (transfer.toGodown.equals(godownId)) {
          // If this godown was the receiver, return stock to the original source godown
      

          await Products.updateOne(
            { _id: item.productId },
            {
              $inc: { "godownStock.$[elem].quantity": -item.quantity }
            },
            { arrayFilters: [{ "elem.godownId": godownId }], session }
          );

          // Now add back the stock to the source godown
          await Products.updateOne(
            { _id: item.productId },
            {
              $inc: { "godownStock.$[elem].quantity": item.quantity }
            },
            { arrayFilters: [{ "elem.godownId": transfer.fromGodown }], session }
          );  

        }
      }
    }

    // Delete all stock transfers related to this godown
    await StockTransfers.deleteMany(
      { $or: [{ fromGodown: godownId }, { toGodown: godownId }] },
      { session }
    );


    //Deleting godown
    const deletedGodown = await Godown.findOneAndDelete(
      {
        _id: godownId,
        isMain: false,
        createdBy: req.user,
        companyId: req.companyId,
      },
      { session }
    );

    if (!deletedGodown) {
      return res
        .status(404)
        .json({ message: "Godown not found or unauthorized action" });
    };

    await session.commitTransaction();

    res.status(200).json({
      message: "Godown Deleted Successfully",
      data: deletedGodown,
    });
  } catch (error) {
    console.error("Error deleting godown:", error);
    await session.abortTransaction();
    res
      .status(500)
      .json({ message: "Failed to delete godown", error: error.message });
  } finally {
    session.endSession();
  }
};

const getGodownTypeList = async (req, res) => {
  let typeList = [
    { name: "Godown", value: "Godown" },
    { name: "Retail Store", value: "Retail Store" },
    { name: "Wholesale Store", value: "Wholesale Store" },
    { name: "Assembly Plant", value: "Assembly Plant" },
    { name: "Others", value: "Others" },
  ];

  res.status(200).json({
    status: "Success",
    message: "Godown Types Fetched Successfully",
    data: typeList,
  });
};

module.exports = {
  addGodown,
  editGodown,
  deleteGodown,
  getGodownDetailsById,
  getAllGodowns,
  getGodownTypeList,
  getStockTransfersForGodown,
};

const mongoose = require("mongoose");
const PurchaseOrder = require("../../models/purchase/purchaseOrderModel");
const Transactions = require("../../models/transactionModel");
const Parties = require("../../models/partyModel");
const Products = require("../../models/productModel");
const Units = require("../../models/unitModel");
const SeriesNumber = require("../../models/seriesnumber");
const formatDate = require("../../global/formatDate");
const { validatePaymentMethods, validateTransactionAmounts } = require("../../utils/validationUtils");
const {
  checkDocumentCanDelete,
  updateChequeReference,
  updateCheque,
  createCheque,
  deleteChequesByReference,
  handleChequeUpdates,
} = require("../../utils/cheques");
const { processItems, findGodown } = require("../../utils/itemUtils");
const { findOrCreateParty } = require("../../utils/partyUtils");
const { parseDocumentNo } = require("../../utils/utils");

exports.getPoNumber = async (req, res) => {
  try {
    let data = await SeriesNumber.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select("poNumber");

    if (!data) {
      return res.status(200).json({ error: "Data not Found!!!!" });
    }

    data = {
      _id: data._id,
      poNumber: `${req?.prefix ? req.prefix + "-" : ""}${data.poNumber}`,
    };

    res.status(200).json({ status: "Success", data: data });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
};

exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const { search, fromDate, toDate } = req.query;

    let searchConditions = {
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    };

    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      searchConditions.orderDate = { $gte: startDate, $lte: endDate };
    }

    if (search) {
      const regex = new RegExp(search, "i");
      searchConditions.$or = [
        { orderNo: { $regex: regex } },
        { partyName: { $regex: regex } },
        { status: { $regex: regex } },
      ];

      const searchNumber = parseFloat(search);
      if (!isNaN(searchNumber)) {
        searchConditions.$or.push(
          { totalAmount: { $eq: searchNumber } },
          { balanceAmount: { $eq: searchNumber } }
        );
      }
    }

    const PurchaseList = await PurchaseOrder.find(searchConditions)
      .select(
        "orderNo orderDate partyName status totalAmount balanceAmount conversionDetails isConverted"
      )
      .sort({ orderDate: -1 });

    if (!PurchaseList) {
      return res.status(200).json({ error: "Data not Found!!!!" });
    }

    const formattedEntries = PurchaseList.map((item) => {
      const formattedDate = formatDate(item.orderDate);

      return {
        ...item._doc,
        orderDate: formattedDate,
      };
    });

    res.status(200).json({ status: "Success", data: formattedEntries });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
};

exports.getPurchaseOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res
        .status(400)
        .json({ status: "Failed", message: "Order Id is Required" });
    }

    const orderData = await PurchaseOrder.findOne({
      _id: orderId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    })
      .select("-_id -isConverted -conversionDetails")
      .populate({ path: "stateOfSupply" })
      .populate({ path: "godown", select: "name" })
      .populate({ path: "paymentMethod.bankName", select: "_id bankName" })
      .populate({ path: "items.itemId", select: " -_id itemName itemHsn" })
      .populate({ path: "items.unit" })
      .populate({ path: "items.taxPercent" });

    if (!orderData) {
      return res.status(404).json({ error: "Purchase Order not Found!!!!" });
    }
    orderData.orderDate = formatDate(orderData.orderDate);
    orderData.dueDate = formatDate(orderData.dueDate);

    res.status(200).json({ status: "Success", data: orderData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
};

exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Destructure data from request body
    let {
      partyId,
      party,
      orderNo,
      orderDate,
      dueDate,
      stateOfSupply,
      description,
      paymentMethod,
      roundOff,
      items,
      totalDiscount,
      totalAmount,
      balanceAmount,
      advanceAmount,
      godown
    } = req.body;

    const isOrderNoExists = await PurchaseOrder.findOne({
      orderNo,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    if (isOrderNoExists) {
      return res
        .status(409)
        .json({ status: "Failed", message: "Order No. already Exists" });
    };

    items = items ? JSON.parse(items) : [];
    stateOfSupply = !stateOfSupply ? null : stateOfSupply;

    totalDiscount = !totalDiscount ? 0 : totalDiscount;

    // Validation to ensure totalAmount, advanceAmount, and balanceAmount are correct
    const validationError = validateTransactionAmounts({
      total: totalAmount,
      receivedOrPaid: advanceAmount,
      balance: balanceAmount,
      type: "Advance",
      itemSettings: req?.itemSettings
    });

    if (validationError) {
      return res.status(400).json({ status: "Failed", message: validationError });
    };

    let image = "",
      document = "";
    balanceAmount = balanceAmount || 0;

    if (req.files) {
      for (const file of req.files) {
        if (["image/png", "image/jpg", "image/jpeg"].includes(file.mimetype)) {
          image = file.filename;
        } else {
          document = file.filename;
        }
      }
    };

    partyId = await findOrCreateParty(
      party,
      req.user,
      req.companyId,
      req.userRole,
      req.currentUser,
      session
    );

    //verifying and Formatting Items(if item exist)
    if (items.length > 0) {
      items = await processItems(
        items,
        req.user,
        req.companyId,
        req.mainGodownId,
        session
      );
    };

    //Fetching Godown Id
    godown = !godown ? req.mainGodownId : await findGodown(godown, req.companyId, req.user);

    // verifying and formatting payment Type
    paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

    //Validating Payment Methods
    const validationResponse = validatePaymentMethods(paymentMethod, res);

    if (validationResponse !== true) {
      return validationResponse;
    }

    // Processing each payment method to  create cheques
    if (parseFloat(advanceAmount) > 0) {
      for (const payment of paymentMethod) {
        if (payment.method === "Cheque") {
          const chequeData = {
            partyName: party,
            party: partyId,
            transactionType: "debit",
            date: orderDate,
            amount: payment.amount,
            referenceNo: payment.referenceNo ? payment.referenceNo : "",
            source: "PurchaseOrder",
            reference: null,
            status: "open",
            createdBy: req.user,
            "companyDetails.companyId": req.companyId,
          };

          const savedCheque = await createCheque(chequeData, session);
          payment.chequeId = savedCheque._id;
        }
      }
    };

    const savedOrder = await PurchaseOrder.create(
      [
        {
          party: partyId,
          partyName: party,
          godown,
          orderNo,
          orderDate,
          dueDate,
          stateOfSupply,
          document,
          image,
          items,
          status: "Order Open",
          roundOff,
          totalDiscount: +totalDiscount,
          totalAmount,
          advanceAmount,
          balanceAmount,
          description,
          paymentMethod,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        },
      ],
      { session }
    );

    if (!savedOrder) {
      throw new Error(`Failed to save Order`);
    }

    const transactionReference = {
      documentId: savedOrder[0]._id,
      documentNumber: savedOrder[0].orderNo,
      docName: "PurchaseOrders",
    };

    // Create the transaction
    const savedTransaction = await Transactions.create(
      [
        {
          transactionType: "Purchase Order",
          party: partyId,
          totalAmount,
          totalDiscount: +totalDiscount,
          debit_amount: advanceAmount,
          balance: balanceAmount,
          description,
          reference: transactionReference,
          paymentMethod,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        },
      ],
      { session }
    );

    if (!savedTransaction) {
      throw new Error("Failed to save transaction");
    }

    let getLatestOrderNo = await SeriesNumber.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select("poNumber");

    let currentOrderNo = parseDocumentNo(orderNo, "orderNo");
    if (currentOrderNo.status === "Failed")
      return res.status(400).json(currentOrderNo);

    if (+currentOrderNo >= getLatestOrderNo.poNumber) {
      const updatedSeries = await SeriesNumber.findOneAndUpdate(
        { createdBy: req.user, "companyDetails.companyId": req.companyId },
        { poNumber: +currentOrderNo + 1 },
        { new: true, session }
      );

      if (!updatedSeries) {
        throw new Error("Failed to update series value");
      }
    }

    // After the Payment-Out is saved, update the cheque's reference to point to the saved Payment-Out
    await updateChequeReference(
      savedOrder[0].paymentMethod,
      savedOrder,
      session,
      "Save"
    );

    await session.commitTransaction();
    res.status(201).json({
      status: "Success",
      message: "Purchase Order Created Successfully",
      data: savedOrder,
    });
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  } finally {
    session.endSession();
  }
};

exports.updateOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Get orderId from params
    const { orderId } = req.params;

    // Destructure data from request body
    let {
      partyId,
      party,
      orderNo,
      orderDate,
      dueDate,
      stateOfSupply,
      description,
      paymentMethod,
      roundOff,
      items,
      totalAmount,
      balanceAmount,
      advanceAmount,
      godown
    } = req.body;

    // Parse items and handle image/document uploads
    items = items ? JSON.parse(items) : [];

    //Fetching Godown Id
    godown = !godown ? req.mainGodownId : await findGodown(godown, req.companyId, req.user);

    let image = "",
      document = "";
    balanceAmount = balanceAmount || 0;
    stateOfSupply = !stateOfSupply ? null : stateOfSupply;

    if (req.files) {
      for (const file of req.files) {
        if (["image/png", "image/jpg", "image/jpeg"].includes(file.mimetype)) {
          image = file.filename;
        } else {
          document = file.filename;
        }
      }
    }

    // Check if the order exists
    const existingOrder = await PurchaseOrder.findOne({
      _id: orderId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });
    if (!existingOrder) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Order not found" });
    }

    if (existingOrder.isConverted) {
      return res.status(200).json({
        status: "Failed",
        message: "Transaction is already converted into Purchase Bill",
      });
    };


    // Validation to ensure totalAmount, advanceAmount, and balanceAmount are correct
    const validationError = validateTransactionAmounts({
      total: totalAmount,
      receivedOrPaid: advanceAmount,
      balance: balanceAmount,
      type: "Advance",
      itemSettings: req?.itemSettings
    });

    if (validationError) {
      return res.status(400).json({ status: "Failed", message: validationError });
    };

    // Validate party details
    partyId = await findOrCreateParty(
      party,
      req.user,
      req.companyId,
      req.userRole,
      req.currentUser,
      session
    );

    //verifying and Formatting Items(if item exist)
    if (items.length > 0) {
      items = await processItems(
        items,
        req.user,
        req.companyId,
        req.mainGodownId,
        session
      );
    };

    //Validating Payment Methods
    const validationResponse = validatePaymentMethods(paymentMethod, res);

    if (validationResponse !== true) {
      return validationResponse;
    }

    //Verifying and formatting payment Type
    paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

    // Processing each payment method to either create cheques or update
    const existingPaymentMethods = existingBill.paymentMethod;

    // Handle cheque updates (delete removed cheques)
    await handleChequeUpdates(existingPaymentMethods, paymentMethod, session);

    for (const payment of paymentMethod) {
      if (payment.method === "Cheque") {
        const chequeData = {
          partyName,
          party: partyId,
          transactionType: "debit",
          date: orderDate,
          amount: payment.amount,
          referenceNo: payment.referenceNo ? payment.referenceNo : "",
          source: "PurchaseOrders",
          reference: null,
          status: "open",
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        };

        // If chequeId exists, update the cheque, otherwise create a new one
        if (payment.chequeId) {
          await updateCheque(payment.chequeId, chequeData, session);
        } else {
          if (parseFloat(advanceAmount) > 0) {
            const savedCheque = await createCheque(chequeData, session);
            payment.chequeId = savedCheque._id;
          }
        }
      }
    }

    const updatedOrder = await PurchaseOrder.findOneAndUpdate(
      { _id: orderId },
      {
        $set: {
          party: partyId,
          partyName: party,
          orderNo,
          orderDate,
          dueDate,
          godown,
          stateOfSupply,
          description,
          document: document || existingOrder.document,
          image: image || existingOrder.image,
          items,
          roundOff,
          totalDiscount: +totalDiscount,
          totalAmount,
          advanceAmount,
          balanceAmount,
          paymentMethod,
        },
      },
      { new: true, session }
    );

    if (!updatedOrder) {
      throw new Error("Failed to update order");
    };

    const transactionReference = {
      documentId: updatedOrder._id,
      documentNumber: updatedOrder.orderNo,
      docName: "PurchaseOrders",
    };

    // Update transaction associated with this order
    const updatedTransaction = await Transactions.findOneAndUpdate(
      { "reference.documentId": updatedOrder._id },
      {
        $set: {
          transactionType: "Purchase Order",
          party: partyId,
          totalAmount,
          totalDiscount: +totalDiscount,
          debit_amount: advanceAmount,
          balance: balanceAmount,
          description,
          paymentMethod,
          reference: transactionReference,
        },
      },
      { new: true, session }
    );

    if (!updatedTransaction) {
      throw new Error("Failed to update transaction");
    };

    let getLatestOrderNo = await SeriesNumber.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select("poNumber");

    // Update invoice number series if bill number changed
    if (existingOrder.orderNo !== orderNo) {
      if (+orderNo >= getLatestOrderNo.poNumber) {
        const updatedSeries = await SeriesNumber.findOneAndUpdate(
          { createdBy: req.user, "companyDetails.companyId": req.companyId },
          { poNumber: +orderNo + 1 },
          { new: true, session }
        );

        if (!updatedSeries) {
          throw new Error("Failed to update series value");
        };
      }
    };

    // After the invoice is saved, update the cheque's reference to point to the saved invoice
    await updateChequeReference(
      updatedOrder.paymentMethod,
      updatedOrder,
      session,
      "Update"
    );

    await session.commitTransaction();

    res.status(200).json({
      status: "Success",
      message: "Purchase Order Updated Successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  } finally {
    session.endSession();
  }
};

exports.deleteOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res
        .status(400)
        .json({ status: "Failed", message: "Order Id is Required" });
    }

    const existingOrder = await PurchaseOrder.findOne({
      _id: orderId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });
    if (!existingOrder) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Order not found" });
    }

    //Checking whether purchase bill can delete or not
    let canOrderDeleted = await checkDocumentCanDelete(
      orderId,
      req.user,
      req.companyId
    );

    if (!canOrderDeleted) {
      return res.status(200).json({
        status: "Failed",
        message: `Transaction Cannot be deleted as cheque of this transaction is closed`,
      });
    }

    // Find and delete the associated transaction
    const deletedTransaction = await Transactions.findOneAndDelete(
      {
        "reference.documentId": orderId,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      { session }
    );

    //commenting validation for deleting transaction as transaction won't exist in convert purchase orders making it unable to delete from po list
    // if (!deletedTransaction) {
    //   throw new Error("Failed to delete transaction");
    // }

    // Delete the purchase order
    const deletedOrder = await PurchaseOrder.findOneAndDelete(
      {
        _id: orderId,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      { session }
    );

    if (!deletedOrder) {
      throw new Error("Failed to delete order");
    }

    //Deleting all the cheques of this order
    await deleteChequesByReference(orderId, session);

    await session.commitTransaction();
    res.status(200).json({
      status: "Success",
      message: "Purchase Order and Transaction deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  } finally {
    session.endSession();
  }
};

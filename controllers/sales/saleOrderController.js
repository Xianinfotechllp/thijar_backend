const SaleOrders = require("../../models/saleOrderModel");
const Parties = require("../../models/partyModel");
const Transactions = require("../../models/transactionModel");
const Quotations = require("../../models/quotationModel");
const Products = require("../../models/productModel");
const Units = require("../../models/unitModel");
const SeriesNumber = require("../../models/seriesnumber");
const formatDate = require("../../global/formatDate");
const { deleteFile } = require("../../global/deleteFIle");
const mongoose = require("mongoose");
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

exports.getOrderNo = async (req, res) => {
  try {
    let data = await SeriesNumber.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select("orderNo");

    if (!data) {
      return res.status(200).json({ error: "Data not Found!!!!" });
    }

    data = {
      _id: data._id,
      orderNo: `${req?.prefix ? req.prefix + "-" : ""}${data.orderNo}`,
    };

    res.status(200).json({ status: "Success", data: data });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ status: "Failed", message: "Sale Order Id is Required" });
    }
    const saleOrderData = await SaleOrders.findOne({
      _id: id,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    })
      .populate({ path: "godown", select: "name" })
      .populate({ path: "items.itemId", select: " -_id itemName itemHsn" })
      .populate({ path: "items.unit", select: " -_v" })
      .populate({ path: "stateOfSupply", select: " -_v" })
      .populate({ path: "items.taxPercent" });

    if (!saleOrderData) {
      return res.status(404).json({ error: "Sale Order not Found!!!!" });
    }
    saleOrderData.orderDate = formatDate(saleOrderData.orderDate);

    res.status(200).json({ status: "Success", data: saleOrderData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { search, fromDate, toDate } = req.query;

    let searchConditions = {
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    };

    //Access Control for Salesman
    req?.userRole?.toLowerCase() == "admin"
      ? ""
      : (searchConditions["companyDetails.userId"] = req.currentUser);

    // Date range filter
    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      endDate.setDate(endDate.getDate() + 1);

      // Validate if dates are properly parsed
      if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ message: "Invalid date range provided" });
      }

      searchConditions.orderDate = { $gte: startDate, $lt: endDate };
    };

    // Search logic
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const searchNumeric = parseFloat(search);

      const searchFields = {
        $or: [
          ...(isNaN(searchNumeric)
            ? []
            : [
              { orderNo: searchNumeric },
              { totalAmount: searchNumeric },
              { balanceAmount: searchNumeric },
            ]),
          { orderNo: { $regex: searchRegex } },
          { partyName: { $regex: searchRegex } },
          {
            $expr: {
              $regexMatch: {
                input: {
                  $dateToString: { format: "%Y-%m-%d", date: "$orderDate" },
                },
                regex: search,
              },
            },
          },
        ],
      };

      // Combining date range and search conditions
      searchConditions = {
        $and: [searchConditions, searchFields],
      };
    };

    const orderData = await SaleOrders.find(searchConditions)
      .select(
        "orderDate dueDate orderNo partyName totalAmount balanceAmount _id  status conversionDetails "
      )
      .sort({ orderDate: -1 });

    if (!orderData.length) {
      return res
        .status(200)
        .json({ status: "Success", message: "No data found" });
    };

    const formattedEntries = orderData.map((item) => {
      const formattedDate = formatDate(item.orderDate);

      return {
        ...item._doc,
        orderDate: formattedDate,
      };
    });

    res.status(200).json({ status: "Success", data: formattedEntries });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};


exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let {
      partyId,
      party,
      billingAddress,
      phoneNo,
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
      poReference,
      godown
    } = req.body;

    const isOrderNoExists = await SaleOrders.findOne({
      orderNo,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    if (isOrderNoExists) {
      return res
        .status(409)
        .json({ status: "Failed", message: "Order No. already Exists" });
    };

    poReference =
      poReference && typeof poReference === "string"
        ? JSON.parse(poReference)
        : {};

    stateOfSupply = !stateOfSupply ? null : stateOfSupply;

    totalDiscount = !totalDiscount ? 0 : totalDiscount;


    // Parse items and handle image/document uploads
    items = items ? JSON.parse(items) : [];


    let image = "",
      document = "";
    balanceAmount = balanceAmount || 0;

    // Validation to ensure totalAmount, advancedAmount, and balanceAmount are correct
    const validationError = validateTransactionAmounts({
      total: totalAmount,
      receivedOrPaid: advanceAmount,
      balance: balanceAmount,
      type: "Advanced",
      itemSettings: req?.itemSettings
    });

    if (validationError) {
      return res.status(400).json({ status: "Failed", message: validationError });
    };

    //Fetching Godown Id
    godown = !godown ? req.mainGodownId : await findGodown(godown, req.companyId, req.user);

    if (req.files) {
      for (const file of req.files) {
        if (["image/png", "image/jpg", "image/jpeg"].includes(file.mimetype)) {
          image = file.filename;
        } else {
          document = file.filename;
        }
      }
    };

    let companyDetails = {
      companyId: req.companyId,
      userId: req?.currentUser,
    };

    partyId = await findOrCreateParty(
      party,
      req.user,
      req.companyId,
      req.userRole,
      req.currentUser,
      session
    );

    // Validating and formatting  payment Method
    paymentMethod = JSON.parse(paymentMethod);

    //Validating Payment Methods
    const validationResponse = validatePaymentMethods(paymentMethod, res);

    if (validationResponse !== true) {
      return validationResponse;
    }

    //verifying and Formatting Items(if item exist)

    if (items.length > 0) {
      items = await processItems(
        items,
        req.user,
        req.companyId,
        req.mainGodownId,
        session
      );
    }

    if (parseFloat(advanceAmount) > 0) {
      // Processing each payment method to either create  cheques
      for (const payment of paymentMethod) {
        if (payment.method === "Cheque") {
          const chequeData = {
            partyName: party,
            party: partyId,
            transactionType: "credit",
            date: orderDate,
            amount: payment.amount,
            referenceNo: payment.referenceNo ? payment.referenceNo : "",
            source: "SaleOrder",
            reference: null,
            status: "open",
            createdBy: req.user,
            companyDetails,
          };

          if (parseFloat(balanceAmount) > 0) {
            const savedCheque = await createCheque(chequeData, session);
            payment.chequeId = savedCheque._id;
          }
        }
      }
    }

    const savedOrder = await SaleOrders.create(
      [
        {
          poReference,
          party: partyId,
          partyName: party,
          orderNo,
          orderDate,
          dueDate,
          godown,
          billingAddress,
          stateOfSupply,
          phoneNo,
          document,
          image,
          items,
          status: "Order Open",
          totalDiscount: +totalDiscount,
          roundOff,
          totalAmount,
          advanceAmount,
          balanceAmount,
          paymentMethod,
          createdBy: req.user,
          companyDetails,
        },
      ],
      { session }
    );

    if (!savedOrder) {
      throw new Error(`Failed to save Order`);
    };

    const transactionReference = {
      documentId: savedOrder[0]._id,
      documentNumber: savedOrder[0].orderNo,
      docName: "SaleOrder",
    };

    // Create the transaction
    const savedTransaction = await Transactions.create(
      [
        {
          transactionType: "Sale Order",
          party: partyId,
          totalDiscount: +totalDiscount,
          totalAmount,
          credit_amount: advanceAmount,
          balance: balanceAmount,
          description,
          reference: transactionReference,
          paymentMethod,
          createdBy: req.user,
          companyDetails,
        },
      ],
      { session }
    );

    if (!savedTransaction) {
      throw new Error("Failed to save transaction");
    }

    // After the order is saved, update the cheque's reference to point to the saved order
    await updateChequeReference(
      savedOrder[0].paymentMethod,
      savedOrder,
      session,
      "Save"
    );

    const { poId, poNumber, poDate } = poReference;

    if (poId && poNumber) {
      const conversionDetails = {
        documentId: savedOrder[0]._id,
        documentType: "SaleOrder",
        documentNo: savedOrder[0].orderNo,
      };

      const updatedEstimate = await Quotations.findOneAndUpdate(
        {
          _id: poId,
          referenceNo: poNumber,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
          isConverted: false,
        },
        { $set: { isConverted: true, conversionDetails } },
        { new: true, session }
      );

      if (!updatedEstimate) {
        throw new Error(`Failed to Update Estimate`);
      }
    };

    let getLatestOrderNo = await SeriesNumber.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select("orderNo");

    let currentOrderNo = parseDocumentNo(orderNo, "orderNo");
    if (currentOrderNo?.status === "Failed")
      return res.status(400).json(currentOrderNo);

    if (+currentOrderNo >= getLatestOrderNo.orderNo) {
      // Increment the seriesValue by 1 in the Series collection
      const updatedSeries = await SeriesNumber.findOneAndUpdate(
        { createdBy: req.user, "companyDetails.companyId": req.companyId },
        { orderNo: +currentOrderNo + 1 },
        { new: true, session }
      );

      if (!updatedSeries) {
        throw new Error("Failed to update series value");
      }
    };

    await session.commitTransaction();

    res.status(201).json({
      status: "Success",
      message: "Sale Order Created Successfully",
      data: savedOrder,
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

exports.updateOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let {
      partyId,
      party,
      billingAddress,
      phoneNo,
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
      godown,
      totalDiscount
    } = req.body;

    // Parse items and handle image/document uploads
    items = items ? JSON.parse(items) : [];

    let image = "",
      document = "";
    balanceAmount = balanceAmount || 0;

    //Fetching Godown Id
    godown = !godown ? req.mainGodownId : await findGodown(godown, req.companyId, req.user);

    stateOfSupply = !stateOfSupply ? null : stateOfSupply;

    totalDiscount = !totalDiscount ? 0 : totalDiscount;

    paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

    //Validating Payment Methods
    const validationResponse = validatePaymentMethods(paymentMethod, res);

    if (validationResponse !== true) {
      return validationResponse;
    };


    // Validation to ensure totalAmount, advancedAmount, and balanceAmount are correct
    const validationError = validateTransactionAmounts({
      total: totalAmount,
      receivedOrPaid: advanceAmount,
      balance: balanceAmount,
      type: "Advanced",
      itemSettings: req?.itemSettings
    });

    if (validationError) {
      return res.status(400).json({ status: "Failed", message: validationError });
    };
    // Find the existing order
    const existingOrder = await SaleOrders.findOne({
      _id: req.params.id,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });
    if (!existingOrder) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Order not found" });
    }

    if (req.files) {
      for (const file of req.files) {
        if (["image/png", "image/jpg", "image/jpeg"].includes(file.mimetype)) {
          image = file.filename;
        } else {
          document = file.filename;
        }
      }
    }

    partyId = await findOrCreateParty(
      party,
      req.user,
      req.companyId,
      req.userRole,
      req.currentUser,
      session
    );

    const existingPaymentMethods = existingOrder.paymentMethod;

    let companyDetails = {
      companyId: req.companyId,
      userId: req?.currentUser,
    };

    // Handle cheque updates (delete removed cheques)
    await handleChequeUpdates(existingPaymentMethods, paymentMethod, session);

    if (parseFloat(advanceAmount) > 0) {
      // Processing each payment method to either create  cheques
      for (const payment of paymentMethod) {
        if (payment.method === "Cheque") {
          const chequeData = {
            partyName: party,
            party: partyId,
            transactionType: "credit",
            date: orderDate,
            amount: payment.amount,
            referenceNo: payment.referenceNo ? payment.referenceNo : "",
            source: "SaleOrder",
            reference: null,
            status: "open",
            createdBy: req.user,
            companyDetails,
          };

          // If chequeId exists, update the cheque, otherwise create a new one
          if (payment?.chequeId) {
            await updateCheque(payment?.chequeId, chequeData, session);
          } else {
            if (balanceAmount == 0) {
              const savedCheque = await createCheque(chequeData, session);
              payment.chequeId = savedCheque._id;
            }
          }
        }
      }
    }

    //verifying and Formatting Items(if item exist)
    if (items.length > 0) {
      items = await processItems(
        items,
        req.user,
        req.companyId,
        req.mainGodownId,
        session
      );
    }

    // if advance Amount is 00 then delete all existing cheque of this order
    if (parseFloat(advanceAmount) <= 0) {
      await deleteChequesByReference(req.params.id, session);

      for (const payment of paymentMethod) {
        payment.chequeId = null;
      }
    }

    // Update the order with new data
    const updatedOrder = await SaleOrders.findOneAndUpdate(
      { _id: req.params.id },
      {
        party: partyId,
        partyName: party,
        orderNo,
        orderDate,
        dueDate,
        godown: !godown ? req.mainGodownId : godown,
        billingAddress,
        stateOfSupply,
        phoneNo,
        document,
        image,
        items,
        roundOff,
        totalDiscount: +totalDiscount,
        totalAmount,
        advanceAmount,
        balanceAmount,
        paymentMethod,
      },
      { new: true, session }
    );

    if (!updatedOrder) {
      throw new Error("Failed to update Order");
    }

    // Update the transaction related to this order
    const transactionReference = {
      documentId: updatedOrder._id,
      documentNumber: updatedOrder.orderNo,
      docName: "SaleOrder",
    };

    const updatedTransaction = await Transactions.findOneAndUpdate(
      { "reference.documentId": existingOrder._id },
      {
        transactionType: "Sale Order",
        party: partyId,
        totalAmount,
        totalDiscount: +totalDiscount,
        credit_amount: advanceAmount,
        balance: balanceAmount,
        description,
        reference: transactionReference,
        paymentMethod,
      },
      { new: true, session }
    );

    if (!updatedTransaction) {
      throw new Error("Failed to update transaction");
    }

    //If Sale Order is Generated from Estimate
    const { poId, poNumber, date } = existingOrder.poReference;

    const conversionDetails = {
      documentId: updatedOrder._id,
      documentType: "SaleOrder",
      documentNo: updatedOrder.orderNo,
    };

    if (poId && poNumber) {
      const updatedQuotation = await Quotations.findOneAndUpdate(
        {
          _id: poId.toString(),
          referenceNo: poNumber,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
          isConverted: "true",
        },
        {
          conversionDetails,
        },
        { new: true, session }
      );

      if (!updatedQuotation) {
        throw new Error("Failed to update Estimate");
      }
    }

    // After the order is updated, update the cheque's reference to point to the saved order
    await updateChequeReference(
      updatedOrder.paymentMethod,
      updatedOrder,
      session,
      "Update"
    );

    await session.commitTransaction();
    res.status(200).json({
      status: "Success",
      message: "Sale Order Updated Successfully",
      data: updatedOrder,
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
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
    const { id } = req.params;

    // Find the order by ID
    const existingOrder = await SaleOrders.findOne({
      _id: id,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });
    if (!existingOrder) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Order not found" });
    }

    let canInvoiceDelete = await checkDocumentCanDelete(
      id,
      req.user,
      req.companyId
    );

    if (!canInvoiceDelete) {
      return res.status(200).json({
        status: "Failed",
        message: `Transaction Cannot be deleted as cheque of this transaction is closed`,
      });
    }

    const { poId, poNumber } = existingOrder.poReference;

    if (existingOrder.image) {
      await deleteFile(existingOrder.image, "images");
    }

    if (existingOrder.document) {
      await deleteFile(existingOrder.document, "docs");
    }

    // Delete the related transaction
    const deletedTransaction = await Transactions.findOneAndDelete(
      {
        "reference.documentId": existingOrder._id,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      { session }
    );

    if (!deletedTransaction) {
      throw new Error("Failed to delete transaction related to the order");
    }

    // Delete the order
    const deletedOrder = await SaleOrders.findOneAndDelete(
      { _id: id },
      { session }
    );
    if (!deletedOrder) {
      throw new Error("Failed to delete the order");
    }

    if (poId && poNumber) {
      const updatedQuotation = await Quotations.findOneAndUpdate(
        {
          _id: poId.toString(),
          referenceNo: poNumber,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
          isConverted: "true",
        },
        {
          "conversionDetails.isDeleted": true,
        },
        { new: true, session }
      );

      if (!updatedQuotation) {
        throw new Error("Failed to update Estimate");
      }
    }

    //Deleting all the cheques of this Sale Order (if there)
    await deleteChequesByReference(id, session);

    await session.commitTransaction();

    res.status(200).json({
      status: "Success",
      message: "Sale Order and related transaction deleted successfully",
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

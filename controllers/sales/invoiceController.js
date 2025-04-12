const Invoices = require("../../models/invoiceModel");
const SeriesNumber = require("../../models/seriesnumber");
const Transactions = require("../../models/transactionModel");
const Parties = require("../../models/partyModel");
const Quotations = require("../../models/quotationModel");
const Challan = require("../../models/deliveryChallan");
const Units = require("../../models/unitModel");
const Products = require("../../models/productModel");
const SaleOrder = require("../../models/saleOrderModel");
const Banks = require("../../models/bankModel");
const TaxRates = require("../../models/taxModel");
const path = require("path");
const PDFDocument = require("pdfkit");
const { deleteFile } = require("../../global/deleteFIle");
const mongoose = require("mongoose");
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

exports.getAllInvoices = async (req, res) => {
  try {
    const { fromDate, toDate, search } = req.query;

    let searchConditions = {
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    };

    //Access Control for Salesman
    req?.userRole?.toLowerCase() == "salesman"
      ? (searchConditions["companyDetails.userId"] = req.currentUser)
      : "";


    // Date range filter
    if (fromDate && toDate) {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      endDate.setDate(endDate.getDate() + 1);
      searchConditions.invoiceDate = { $gte: startDate, $lte: endDate };
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
              { totalAmount: searchNumeric },
              { balanceAmount: searchNumeric },
              { invoiceNo: searchNumeric },
            ]),
          { invoiceNo: { $regex: searchRegex } },
          { partyName: { $regex: searchRegex } },
          {
            $expr: {
              $regexMatch: {
                input: {
                  $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" },
                },
                regex: search,
              },
            },
          },
        ],
      };

      // Combine date range and search conditions
      searchConditions = {
        $and: [searchConditions, searchFields],
      };
    }

    // Fetch invoice data
    const invoiceData = await Invoices.find(searchConditions)
      .select(
        "invoiceDate invoiceNo partyName invoiceType paymentMethod totalAmount receivedAmount balanceAmount "
      )
      .populate({ path: "paymentMethod.bankName", select: "bankName" })
      .sort({ invoiceDate: -1, invoiceNo: -1 });

    // if (!invoiceData.length) {
    //     return res.status(200).json({ error: "Data not found" });
    // }

    let totalSaleAmount = 0;
    let totalPaidAmount = 0;
    let totalBalanceAmount = 0;
    let cashInHand = 0;

    const formattedEntries = invoiceData.map((item) => {
      totalSaleAmount += item.totalAmount;
      totalPaidAmount += item.receivedAmount;
      totalBalanceAmount += item.balanceAmount;


            // Sum cash amount
            item.paymentMethod.forEach((method) => {
              if (method.method === "Cash" && method.amount) {
                cashInHand += method.amount;
              }
            });

      // Transform the paymentMethod array into a string
      const paymentMethods = item.paymentMethod
        .map((method) => {
          if (method.method === "Bank" && method.bankName) {
            return `${method.bankName.bankName}`;
          }
          return method.method;
        })
        .join(", ");

      return {
        _id: item._id,
        invoiceNo: item.invoiceNo,
        invoiceType: item.invoiceType,
        invoiceDate: formatDate(item.invoiceDate),
        partyName: item.partyName,
        paymentMethod: paymentMethods,
        totalAmount: item.totalAmount,
        balanceAmount: item.balanceAmount,
      };
    });

    console.log(formattedEntries.length, "Length Invoice ");

    res.status(200).json({
      status: "Success",
      data: formattedEntries,
      totalSaleAmount,
      paidAmount: totalPaidAmount,
      unPaidAmount: totalBalanceAmount,
      cashInHand:cashInHand,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
};

exports.getInvoiceNumber = async (req, res) => {
  try {
    let data = await SeriesNumber.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select("invoiceNo prefixes");

    if (!data) {
      return res.status(200).json({ error: "Data not Found!!!!" });
    }

    data = {
      _id: data._id,
      invoiceNo: `${req.prefix ? req.prefix + "-" : ""}${data.invoiceNo}`,
    };

    res.status(200).json({ status: "Success", data: data });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoiceData = await Invoices.findOne({
      _id: invoiceId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    })
      .select("-_id -sourceDetails")
      .populate({ path: "stateOfSupply" })
      .populate({ path: "godown", select: "name" })
      .populate({ path: "paymentMethod.bankName", select: "_id bankName" })
      .populate({ path: "items.itemId", select: " -_id itemName itemHsn" })
      .populate({ path: "items.unit", select: " -_id name" })
      .populate({ path: "items.taxPercent" });

    if (!invoiceData) {
      return res.status(404).json({ error: "Invoice not Found!!!!" });
    }
    invoiceData.invoiceDate = formatDate(invoiceData.invoiceDate);
    res.status(200).json({ status: "Success", data: invoiceData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
};

exports.saveInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let {
      partyName,
      billingAddress,
      phoneNo,
      invoiceNo,
      invoiceType,
      invoiceDate,
      description,
      billingName,
      paymentMethod,
      roundOff,
      items,
      totalAmount,
      balanceAmount,
      receivedAmount,
      source,
      sourceDetails,
      stateOfSupply,
      godown,
      totalDiscount
    } = req.body;



    const isInvoiceNoExists = await Invoices.findOne({
      invoiceNo,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    if (isInvoiceNoExists) {
      return res
        .status(409)
        .json({ status: "Failed", message: "Invoice No. already Exists" });
    }

    if (invoiceType == "Credit" && !partyName) {
      return res.status(200).json({ status: "Failed", message: "The party is required for credit invoices." });
    };

    let partyId;

    if (!source) {
      return res
        .status(400)
        .json({ status: "Failed", message: `Source is Required.` });
    };

    items = !items ? [] : JSON.parse(items);

    totalDiscount = !totalDiscount ? 0 : totalDiscount;

    godown = !godown ? req.mainGodownId : await findGodown(godown, req.companyId, req.user);

    paymentMethod = !paymentMethod ? [] : JSON.parse(paymentMethod);

    if (!["Sale Order", "Challan", "Estimate", "Direct"].includes(source)) {
      return res
        .status(400)
        .json({ status: "Failed", message: `Enter Valid Source` });
    }

    // Ensure sourceDetails exists and is an object
    if (!sourceDetails || typeof sourceDetails !== "string") {
      sourceDetails = {};
      console.log("sourceDetails is not a valid JSON, using empty object.");
    } else {
      sourceDetails = JSON.parse(sourceDetails);
    };

    if (!stateOfSupply) stateOfSupply = null;

    let image = "",
      document = "";
    balanceAmount = balanceAmount || 0;

    //Validating Payment Methods
    const validationResponse = validatePaymentMethods(paymentMethod, res);
    if (validationResponse !== true) {
      return validationResponse;
    };

    console.log(req.body,"Save Invoice Payload");

    // Validation to ensure totalAmount, receivedAmount, and balanceAmount are correct
    const validationError = validateTransactionAmounts({
      total: totalAmount,
      receivedOrPaid: receivedAmount,
      balance: balanceAmount,
      type: "Received",
      itemSettings: req?.itemSettings
    });

    if (validationError) {
      return res.status(400).json({ status: "Failed", message: validationError });
    };

    if (req.files) {
      for (const file of req.files) {
        if (["image/png", "image/jpg", "image/jpeg"].includes(file.mimetype)) {
          image = file.filename;
        } else {
          document = file.filename;
        }
      }
    };

    if (partyName) {
      // Validate party details
      partyId = await findOrCreateParty(
        partyName,
        req.user,
        req.companyId,
        req.userRole,
        req.currentUser,
        session
      );

    }

    let companyDetails = {
      companyId: req.companyId,
      userId: req?.currentUser,
    };

    if (balanceAmount == 0) {
      // Processing each payment method to either create  cheques
      for (const payment of paymentMethod) {
        if (payment.method === "Cheque") {
          const chequeData = {
            partyName,
            party: partyId,
            transactionType: "credit",
            date: invoiceDate,
            amount: payment.amount,
            referenceNo: payment.referenceNo ? payment.referenceNo : "",
            source: "Invoices",
            reference: null,
            status: "open",
            createdBy: req.user,
            companyDetails,
          };

          const savedCheque = await createCheque(chequeData, session);
          payment.chequeId = savedCheque._id;
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

    // Set document name based on source
    switch (source) {
      case "Estimate":
        sourceDetails.docName = "Quotations";
        break;
      case "Sale Order":
        sourceDetails.docName = "SaleOrder";
        break;
      case "Challan":
        sourceDetails.docName = "Challan";
        break;
      case "Direct":
        sourceDetails.docName = null;
        break;
      default:
        sourceDetails.docName = null;
    }

    if (source === "Direct") {
      sourceDetails = {};
    }

    // Create the invoice
    const savedInvoice = await Invoices.create(
      [
        {
          party: partyId,
          partyName,
          billingAddress,
          phoneNo,
          godown,
          invoiceNo,
          invoiceType,
          invoiceDate,
          billingName,
          paymentMethod,
          image,
          description,
          document,
          items,
          roundOff,
          totalDiscount: +totalDiscount,
          totalAmount: +totalAmount,
          balanceAmount,
          stateOfSupply,
          source,
          sourceDetails,
          receivedAmount,
          createdBy: req.user,
          companyDetails,
          // 'companyDetails.companyId': req.companyId
        },
      ],
      { session }
    );

    if (!savedInvoice) {
      throw new Error("Failed to save Invoice");
    }

    // Prepare transaction reference
    const transactionReference = {
      documentId: savedInvoice[0]._id,
      documentNumber: invoiceNo,
      docName: "Invoices",
    };

    // Create the transaction document
    const savedTransaction = await Transactions.create(
      [
        {
          transactionType: "Sale",
          transactionDate: invoiceDate,
          totalDiscount: +totalDiscount,
          totalAmount,
          paymentType: invoiceType,
          party: partyId,
          credit_amount: receivedAmount,
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

    // After the invoice is saved, update the cheque's reference to point to the saved invoice
    await updateChequeReference(
      savedInvoice[0].paymentMethod,
      savedInvoice,
      session,
      "Save"
    );



    if (partyName && partyId) {
      // Update party received amount and receivable Balance
      const updateParty = await Parties.findOneAndUpdate(
        {
          _id: partyId,
          name: partyName,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        },
        {
          $inc: {
            receivedAmount: +receivedAmount,
            "balanceDetails.receivableBalance": +balanceAmount,
          },
        },
        { new: true, session }
      );


      if (!updateParty) {
        throw new Error("Failed to update party received amount");
      }
    }




    // Update source if not "Direct"
    if (source !== "Direct") {
      let updatedSource;
      if (
        source === "Estimate" ||
        source === "Sale Order" ||
        source === "Challan"
      ) {
        console.log(`Updating source for ${source}`);

        if (source === "Estimate") {
          const conversionDetails = {
            documentId: savedInvoice[0].id,
            documentType: "Invoices",
            documentNo: invoiceNo,
          };

          updatedSource = await Quotations.findOneAndUpdate(
            {
              _id: sourceDetails.documentId,
              referenceNo: sourceDetails.documentNo,
              isConverted: false,
              createdBy: req.user,
              "companyDetails.companyId": req.companyId,
            },
            { isConverted: true, conversionDetails },
            { new: true, session }
          );

          //Deleting Transaction for estimate before creating new transaction for invoice
          const deleteTransactionForQuotation =
            await Transactions.findOneAndDelete(
              {
                transactionType: source,
                "reference.documentId": sourceDetails.documentId,
                createdBy: req.user,
                "companyDetails.companyId": req.companyId,
              },
              { session }
            );
          if (!deleteTransactionForQuotation) {
            throw new Error(`Failed to Delete ${source} Transaction`);
          }
        }

        if (source === "Challan") {
          const conversionDetails = {
            documentId: savedInvoice[0].id,
            documentType: "Invoices",
            documentNo: invoiceNo,
          };

          updatedSource = await Challan.findOneAndUpdate(
            {
              _id: sourceDetails.documentId,
              challanNo: sourceDetails.documentNo,
              createdBy: req.user,
              "companyDetails.companyId": req.companyId,
              isConverted: false,
            },
            { isConverted: true, conversionDetails },
            { new: true, session }
          );

          //Deleting Transaction for Challan before creating new transaction for invoice
          const deleteTransactionForQuotation =
            await Transactions.findOneAndDelete(
              {
                transactionType: "Delivery Challan",
                "reference.documentId": sourceDetails.documentId,
                createdBy: req.user,
                "companyDetails.companyId": req.companyId,
              },
              { session }
            );

          if (!deleteTransactionForQuotation) {
            throw new Error(`Failed to Delete ${source} Transaction`);
          }
        }

        if (source === "Sale Order") {
          const conversionDetails = {
            documentId: savedInvoice[0].id,
            documentType: "Invoices",
            documentNo: invoiceNo,
          };

          updatedSource = await SaleOrder.findOneAndUpdate(
            {
              _id: sourceDetails.documentId,
              orderNo: sourceDetails.documentNo,
              createdBy: req.user,
              "companyDetails.companyId": req.companyId,
              isConverted: false,
            },
            { isConverted: true, conversionDetails, status: "Order Completed" },
            { new: true, session }
          );

          //Deleting Transaction for Sale Order before creating new transaction for invoice
          const deleteTransactionForQuotation =
            await Transactions.findOneAndDelete(
              {
                transactionType: "Sale Order",
                "reference.documentId": sourceDetails.documentId,
                createdBy: req.user,
                "companyDetails.companyId": req.companyId,
              },
              { session }
            );

          if (!deleteTransactionForQuotation) {
            throw new Error(`Failed to Delete ${source} Transaction`);
          }
        }

        if (!updatedSource) {
          throw new Error(`Failed to update ${source}`);
        }
      }
    }

    // //Updating Stock Quantity in items
    for (const item of items) {
      const { itemId, quantity } = item;

      // Using findOneAndUpdate directly
      const updatedProduct = await Products.findOneAndUpdate(
        {
          _id: itemId,
          type: "Product",
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
          "godownStock.godownId": godown
        },
        {
          $inc: {
            "stock.saleQuantity": quantity,
            "stock.totalQuantity": -quantity,
            "godownStock.$.quantity": -quantity,
          },
          // $inc: {
          //   "godownStock.$.quantity": -quantity, // Update the quantity in the godownStock array
          // },
        },
        { new: true, session } // Return the updated document
      );

      if (!updatedProduct) {
        throw new Error(
          `Failed to update product with itemId ${itemId}. Product not found.`
        );
      } else {
        console.log(`Updated Product`);
      }
    }

    let getLatestInvoiceNo = await SeriesNumber.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select("invoiceNo");

    let currentInvoiceNo = parseDocumentNo(invoiceNo, "invoiceNo");
    if (currentInvoiceNo?.status === "Failed")
      return res.status(400).json(currentInvoiceNo);

    if (+currentInvoiceNo >= getLatestInvoiceNo.invoiceNo) {
      // Update the invoice number series
      const updateSeries = await SeriesNumber.findOneAndUpdate(
        { createdBy: req.user, "companyDetails.companyId": req.companyId },
        { invoiceNo: +currentInvoiceNo + 1 },
        { new: true, session }
      );

      if (!updateSeries) {
        throw new Error(`Failed to update SeriesNumber`);
      }
    }

    // Commit the transaction
    await session.commitTransaction();

    res.status(201).json({
      status: "Success",
      message: "Invoice Saved Successfully",
      data: savedInvoice,
    });
  } catch (error) {
    // Rollback the transaction on error
    await session.abortTransaction();
    console.error(error, "Error");
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  } finally {
    // End the session
    session.endSession();
  }
};

exports.updateInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceId } = req.params;
    let {
      partyName,
      billingAddress,
      phoneNo,
      invoiceNo,
      invoiceType,
      invoiceDate,
      stateOfSupply,
      description,
      billingName,
      paymentMethod,
      roundOff,
      items,
      totalDiscount,
      totalAmount,
      balanceAmount,
      receivedAmount,
      godown,
    } = req.body;

    let partyId;

    // Fetch the existing invoice to retrieve source and sourceDetails
    const existingInvoice = await Invoices.findOne({
      _id: invoiceId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    if (!existingInvoice) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Invoice not found" });
    }

    //Reverting Old Data Process----------------------------------------
    // Reverting stock for previous items
    for (const oldItem of existingInvoice.items) {
      const { itemId, quantity } = oldItem;
      await Products.findOneAndUpdate(
        {
          _id: itemId,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
          "godownStock.godownId": existingInvoice.godown,
        },
        {
          $inc: {
            "stock.saleQuantity": -quantity,
            "stock.totalQuantity": +quantity,
            "godownStock.$.quantity": +quantity,
          },
        },
        // Adding back the quantity to the stock
        { new: true, session }
      );
    }

    //Reverting Received and Balance Amount To Last time Selected Party
    const revertAmount = await Parties.findOneAndUpdate(
      {
        _id: existingInvoice.party,
        name: existingInvoice.partyName,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      {
        $inc: {
          receivedAmount: -existingInvoice.receivedAmount,
          "balanceDetails.receivableBalance": -existingInvoice.balanceAmount,
        },
      },
      { new: true, session }
    );

    if (!revertAmount) {
      throw new Error("Failed to Revert Party Amount");
    };

    //Updating process-----------------------------------------------------------

    let { source, sourceDetails } = existingInvoice;

    // Format and Validate data
    items = items ? JSON.parse(items) : [];


    totalDiscount = !totalDiscount ? 0 : totalDiscount;

    //Fetching Godown Id
    godown = !godown ? req.mainGodownId : await findGodown(godown, req.companyId, req.user);

    let image = existingInvoice.image || "",
      document = existingInvoice.document || "";
    balanceAmount = balanceAmount || 0;

    paymentMethod = paymentMethod ? JSON.parse(paymentMethod) : [];

    stateOfSupply = stateOfSupply ? stateOfSupply : null;

    //Payment Method Validation
    const validationResponse = validatePaymentMethods(paymentMethod, res);

    if (validationResponse !== true) {
      return validationResponse;
    };

    // Validation to ensure totalAmount, receivedAmount, and balanceAmount are correct
    const validationError = validateTransactionAmounts({
      total: totalAmount,
      receivedOrPaid: receivedAmount,
      balance: balanceAmount,
      type: "Received",
      itemSettings: req?.itemSettings
    });

    if (validationError) {
      return res.status(400).json({ status: "Failed", message: validationError });
    };


    if (req.files) {
      for (const file of req.files) {
        if (["image/png", "image/jpg", "image/jpeg"].includes(file.mimetype)) {
          // Delete the old image if it exists
          if (existingInvoice.image) {
            // await deleteFile(existingInvoice.image, 'images');
          }
          image = file.filename;
        } else {
          // Delete the old document if it exists
          if (existingInvoice.document) {
            // await deleteFile(existingInvoice.document, 'docs');
          }
          document = file.filename;
        }
      }
    }

    partyId = await findOrCreateParty(
      partyName,
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
    }

    // Set document name based on source
    switch (source) {
      case "Estimate":
        sourceDetails.docName = "Quotations";
        break;
      case "Sale Order":
        sourceDetails.docName = "SaleOrder";
        break;
      case "Direct":
        sourceDetails.docName = null;
        break;
      case "Challan":
        sourceDetails.docName = "Challan";
        break;
      default:
        sourceDetails.docName = null;
    }

    const existingPaymentMethods = existingInvoice.paymentMethod;

    // Handle cheque updates (delete removed cheques)
    await handleChequeUpdates(existingPaymentMethods, paymentMethod, session);

    // Processing each payment method to either create cheques or update

    for (const payment of paymentMethod) {
      if (payment.method === "Cheque") {
        const chequeData = {
          partyName,
          party: partyId,
          transactionType: "credit",
          date: invoiceDate,
          amount: payment.amount,
          referenceNo: payment.referenceNo ? payment.referenceNo : "",
          source: "Invoices",
          reference: null,
          status: "open",
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
        };

        // If chequeId exists, update the cheque, otherwise create a new one
        if (payment.chequeId) {
          await updateCheque(payment.chequeId, chequeData, session);
        } else {
          const savedCheque = await createCheque(chequeData, session);
          payment.chequeId = savedCheque._id;
        }
      }
    }

    // Update the invoice
    const updatedInvoice = await Invoices.findOneAndUpdate(
      {
        _id: invoiceId,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      {
        party: partyId,
        partyName,
        billingAddress,
        phoneNo,
        invoiceNo,
        invoiceType,
        invoiceDate,
        stateOfSupply,
        billingName,
        paymentMethod,
        image,
        document,
        items,
        roundOff,
        totalAmount: +totalAmount,
        totalDiscount: +totalDiscount,
        balanceAmount,
        source,
        sourceDetails,
        receivedAmount,
        godown,
      },
      { new: true, session }
    );

    if (!updatedInvoice) {
      throw new Error("Failed to update Invoice");
    }

    // Prepare transaction reference
    const transactionReference = {
      documentId: updatedInvoice._id,
      documentNumber: invoiceNo,
      docName: "Invoices",
    };

    // Update the transaction document
    const updatedTransaction = await Transactions.findOneAndUpdate(
      {
        "reference.documentId": invoiceId,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      {
        party: partyId,
        transactionType: "Sale",
        totalDiscount: +totalDiscount,
        totalAmount,
        credit_amount: receivedAmount,
        transactionDate: invoiceDate,
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

    // Update party received amount
    const updateParty = await Parties.findOneAndUpdate(
      {
        _id: partyId,
        name: partyName,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      {
        $inc: {
          receivedAmount: +receivedAmount,
          "balanceDetails.receivableBalance": +balanceAmount,
        },
      },
      { runValidators: true, session }
    );

    if (!updateParty) {
      throw new Error("Failed to update party received amount");
    }

    // Update source if not "Direct"
    if (source !== "Direct") {
      let updatedSource;
      if (
        source === "Estimate" ||
        source === "Sale Order" ||
        source === "Challan"
      ) {
        console.log(`Updating source for ${source}`);

        if (source === "Estimate") {
          const conversionDetails = {
            documentId: updatedInvoice._id,
            documentType: "Invoices",
            documentNo: invoiceNo,
          };

          updatedSource = await Quotations.findOneAndUpdate(
            {
              _id: sourceDetails.documentId,
              referenceNo: sourceDetails.documentNo,
              createdBy: req.user,
              "companyDetails.companyId": req.companyId,
              isConverted: true,
            },
            { $set: { isConverted: true, conversionDetails } },
            { new: true, session }
          );
        }

        if (source === "Challan") {
          const conversionDetails = {
            documentId: updatedInvoice.id,
            documentType: "Invoices",
            documentNo: invoiceNo,
          };

          updatedSource = await Challan.findOneAndUpdate(
            {
              _id: sourceDetails.documentId,
              challanNo: sourceDetails.documentNo,
              createdBy: req.user,
              "companyDetails.companyId": req.companyId,
              isConverted: true,
            },
            { $set: { isConverted: true, conversionDetails } },
            { new: true, session }
          );
        }

        if (source === "Sale Order") {
          const conversionDetails = {
            documentId: updatedInvoice.id,
            documentType: "Invoices",
            documentNo: invoiceNo,
          };

          updatedSource = await SaleOrder.findOneAndUpdate(
            {
              _id: sourceDetails.documentId,
              orderNo: sourceDetails.documentNo,
              createdBy: req.user,
              "companyDetails.companyId": req.companyId,
              isConverted: true,
            },
            {
              $set: { isConverted: true, conversionDetails, status: "Closed" },
            },
            { new: true, session }
          );
        }

        if (!updatedSource) {
          throw new Error(`Failed to update ${source}`);
        }
      }
    }

    // After the invoice is saved, update the cheque's reference to point to the saved invoice
    await updateChequeReference(
      updatedInvoice.paymentMethod,
      updatedInvoice,
      session,
      "Update"
    );


    for (const item of items) {
      const { itemId, quantity } = item;

      // Using findOneAndUpdate directly
      const updatedProduct = await Products.findOneAndUpdate(

        {
          _id: itemId,
          type: "Product",
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
          "godownStock.godownId": godown || req.mainGodownId,
        },
        {
          $inc: {
            "stock.saleQuantity": +quantity,
            "stock.totalQuantity": -quantity,
            "godownStock.$.quantity": -quantity,
          },
        },
        { new: true, runValidators: true, session }
      );

      if (!updatedProduct) {
        throw new Error(
          `Failed to update product with itemId ${itemId}. Product not found.`
        );
      } else {
        console.log(`Updated Product`);
      }
    }

    // Update the invoice number series
    // const updateSeries = await SeriesNumber.findOneAndUpdate(
    //     { createdBy: req.user },
    //     { invoiceNo: +invoiceNo + 1 },
    //     { new: true, session }
    // )

    // if (!updateSeries) {
    //     throw new Error(`Failed to update SeriesNumber`);
    // };

    // Commit the transaction
    await session.commitTransaction();
    res.status(200).json({
      status: "Success",
      message: "Invoice Updated Successfully",
      data: updatedInvoice,
    });
  } catch (error) {
    // Rollback the transaction on error
    await session.abortTransaction();
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  } finally {
    // End the session
    session.endSession();
  }
};

exports.sendInvoicePdf = (req, res) => {
  const { invoiceNumber } = req.params;
  try {
    const invoicePath = path.join(
      "data",
      "invoices",
      `invoice-${invoiceNumber}.pdf`
    );

    fs.readFile(invoicePath, (err, data) => {
      if (err) {
        console.log(err);
        return;
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline;filename="invoice-${invoiceNumber}.pdf"`
      );
      res.send(data);
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
};

exports.deleteInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { invoiceId } = req.params;

    // Find the invoice to delete
    const invoiceToDelete = await Invoices.findOne({
      _id: invoiceId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).session(session);
    if (!invoiceToDelete) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Invoice not found" });
    }

    let canInvoiceDelete = await checkDocumentCanDelete(
      invoiceId,
      req.user,
      req.companyId
    );

    if (!canInvoiceDelete) {
      return res.status(200).json({
        status: "Failed",
        message: `Transaction Cannot be deleted as cheque of this transaction is closed`,
      });
    }

    const {
      invoiceNo,
      items,
      sourceDetails,
      totalAmount,
      party,
      balanceAmount,
      receivedAmount,
    } = invoiceToDelete;

    // Check if the invoice has an image and delete it if it exists
    if (invoiceToDelete.image) {
      await deleteFile(invoiceToDelete.image, "images");
    }

    // Check if the invoice has a document and delete it if it exists
    if (invoiceToDelete.document) {
      await deleteFile(invoiceToDelete.document, "docs");
    }

    // Delete  transaction
    const deletedTransaction = await Transactions.findOneAndDelete({
      "reference.documentId": invoiceId,
      "reference.docName": "Invoices",
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).session(session);

    if (!deletedTransaction) {
      throw new Error("Failed to delete related transaction");
    }

    // Restore stock quantity in products
    for (const item of items) {
      const { itemId, quantity } = item;

      const updatedProduct = await Products.findOneAndUpdate(
        {
          _id: itemId,
          createdBy: req.user,
          "companyDetails.companyId": req.companyId,
          "godownStock.godownId": invoiceToDelete.godown,
        },
        {
          $inc: {
            "stock.saleQuantity": -quantity,
            "stock.totalQuantity": +quantity,
            "godownStock.$.quantity": +quantity,
          },
        },
        { new: true, session }
      );

      if (!updatedProduct) {
        // throw new Error(`Failed to update stock for itemId ${itemId}`);
        console.log(`Failed to update stock for itemId ${itemId}`);
      }
    }

    // Update party's received Amount (remove the invoice amount)
    const updateParty = await Parties.findOneAndUpdate(
      {
        _id: party,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      {
        $inc: {
          receivedAmount: -receivedAmount,
          "balanceDetails.receivableBalance": -balanceAmount,
        },
      },
      { new: true, session }
    );

    if (!updateParty) {
      throw new Error("Failed to update party receivedAmount");
    }

    // Delete the invoice
    const deletedInvoice = await Invoices.findOneAndDelete({
      _id: invoiceId,
    }).session(session);
    if (!deletedInvoice) {
      throw new Error("Failed to delete the invoice");
    }

    // Handle conversion flag if the invoice was generated from an Estimate or Sale Order
    // console.log(sourceDetails,'sourceDetails');

    if (
      sourceDetails &&
      sourceDetails.documentId &&
      sourceDetails.docName === "Quotations"
    ) {
      await Quotations.findOneAndUpdate(
        { _id: sourceDetails.documentId, isConverted: true },
        { $set: { "conversionDetails.isDeleted": true } },
        { new: true, session }
      );
    } else if (
      sourceDetails &&
      sourceDetails.documentId &&
      sourceDetails.docName === "SaleOrder"
    ) {
      await SaleOrder.findOneAndUpdate(
        { _id: sourceDetails.documentId?.toString(), isConverted: true },
        { $set: { "conversionDetails.isDeleted": true } },
        { new: true, session }
      );
    }

    //Deleting all the cheques of this invoice
    await deleteChequesByReference(invoiceId, session);

    await session.commitTransaction();

    res.status(200).json({
      status: "Success",
      message: "Invoice and related data deleted successfully",
    });
  } catch (error) {
    // Rollback the transaction on error
    await session.abortTransaction();
    console.error(error);
    res.status(500).json({
      status: "Failed",
      message: "Internal Server Error",
      error: error.message,
    });
  } finally {
    // End the session
    session.endSession();
  }
};

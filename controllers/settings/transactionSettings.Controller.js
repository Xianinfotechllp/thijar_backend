const TransactionSettings = require("../../models/settings/transactionSettings.Modal");

exports.handleTransactionSettings = async (req, res) => {
  try {
    const booleanFields = {
      enableDeliveryChallan: "Delivery Challan Value must be a boolean",
      enableEstimate: "Estimate Value must be a boolean",
      enableInvoicePreview: "Invoice Preview Value must be a boolean",
      enableSalesOrder: "Sales Order Value must be a boolean",
      enableExportSales: "Export Sales Value must be a boolean",
      enablePurchaseOrder: "Purchase Order Value must be a boolean",
      enableImportPurchase: "Import Purchase Value must be a boolean",
      enableShippingAddress: "Shipping Address Value must be a boolean",
      enablePartyEmail: "Party Email Value must be a boolean",
      enableStateOfSupply: "State Of Supply Value must be a boolean",
    };

    let payload = {};
    for (const [field, errorMessage] of Object.entries(booleanFields)) {
      if (req.body[field] && typeof req.body[field] !== "boolean") {
        return res
          .status(400)
          .json({ status: "Failed", message: errorMessage });
      } else if (req.body[field] !== undefined) {
        console.log(field);
        // add only the fields that are in request
        payload[field] = req.body[field];
      }
    }

    let updatedItemSettings = await TransactionSettings.findOneAndUpdate(
      {
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      {
        $setOnInsert: {
          createdBy: req.user,
          companyDetails: { companyId: req.companyId },
        },
        ...payload,
      },
      { new: true, upsert: true }
    );

    if (!updatedItemSettings) {
      throw new Error(`Error Updating Transaction Settings`);
    }

    res.status(200).json({
      status: "Success",
      message: "Transaction Settings Updated Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

exports.getTransactionSettings = async (req, res) => {
  const transactionSettings =
    (await TransactionSettings.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    })) ||
    new TransactionSettings({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

  try {
    res.status(200).json({
      status: "Success",
      message: "Transaction Settings Fetched Successfully",
      data: transactionSettings,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

const TaxSettings = require("../../models/settings/taxSettings.Modal");

exports.handleTaxSettings = async (req, res) => {
  try {
    let { gstTax, vatTax } = req.body;

    let payload = {};

    if (gstTax || vatTax) {
      if (gstTax == undefined) {
        payload.enableGstPercent = false;
      }
      if (vatTax == undefined) {
        payload.enableVatPercent = false;
      }
    }

    if (vatTax !== undefined && typeof vatTax !== "boolean") {
      return res.status(400).json({
        status: "Failed",
        message: "VAT Tax Value must be a boolean.",
      });
    }

    if (gstTax !== undefined && typeof gstTax !== "boolean") {
      return res
        .status(400)
        .json({ status: "Failed", message: "GST Tax Value must be a boolean" });
    }

    if (vatTax && gstTax) {
      return res
        .status(400)
        .json({ status: "Failed", message: "You can enable only one Tax." });
    }

    if ("vatTax" in req.body && typeof req.body.vatTax === "boolean") {
      payload.enableVatPercent = vatTax;
    }

    if ("gstTax" in req.body && typeof req.body.gstTax === "boolean") {
      payload.enableGstPercent = gstTax;
    }

    const booleanFields = {
      enableEWayBill: "E-Way Bill Value must be a boolean",
      enableEInvoice: "E-Invoice Value must be a boolean",
      enableMyOnlineStore: "My Online Store Value must be a boolean",
    };

    for (const [field, errorMessage] of Object.entries(booleanFields)) {
      if (req.body[field] && typeof req.body[field] !== "boolean") {
        return res
          .status(400)
          .json({ status: "Failed", message: errorMessage });
      } else if (req.body[field] !== undefined) {
        // add only the fields that are in request
        payload[field] = req.body[field];
      }
    }

    let updatedTaxSettings = await TaxSettings.findOneAndUpdate(
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

    if (!updatedTaxSettings) {
      throw new Error(`Error Updating Item Settings`);
    }

    res.status(200).json({
      status: "Success",
      message: "Item Settings Updated Successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

exports.getTaxSettings = async (req, res) => {
  // const taxSettings =
  //   (await TaxSettings.findOne({
  //     createdBy: req.user,
  //     "companyDetails.companyId": req.companyId,
  //   })) ||
  //   new TaxSettings({
  //     createdBy: req.user,
  //     "companyDetails.companyId": req.companyId,
  //   });

  try {
    res.status(200).json({
      status: "Success",
      message: "Tax Settings Fetched Successfully",
      data: req.taxSettings,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

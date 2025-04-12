const ItemSettings = require("../../models/settings/itemSettings.Model");

exports.handleItemSettings = async (req, res) => {
  try {
    let {
      enableItemCode,
      enableItemCategory,
      enableItemHsn,
      enableItemDiscount,
      enableItemMrp,
      enableItemTypes,
      enableItemScanner,
      // client requirement is to have different decimal places for quantity and others(amount, discount,etc)
      quantityDecimalPlaces,
      commonDecimalPlaces,
    } = req.body;

    const booleanFields = {
      enableItemCode: "Item Code Value must be a boolean",
      enableItemCategory: "Category Value must be a boolean",
      enableItemHsn: "HSN Value must be a boolean",
      enableItemDiscount: "Discount Value must be a boolean",
      enableItemMrp: "MRP Value must be a boolean",
      enableItemTypes: "Item Types Value must be a boolean",
      enableItemScanner: "Item Scanner Value must be a boolean",
    };

    let payload = {};

    console.log(payload, "payload");
    for (const [field, errorMessage] of Object.entries(booleanFields)) {
      if (req.body[field] && typeof req.body[field] !== "boolean") {
        return res
          .status(400)
          .json({ status: "Failed", message: errorMessage });
      } else if (req.body[field] !== undefined) {
        // add only the fields that are in request
        payload[field] = req.body[field];
      }
    };

    if (!!quantityDecimalPlaces && isNaN(quantityDecimalPlaces)) {
      return res.status(400).json({
        status: "Failed",
        message: "please enter valid decimal places for quantity.",
      });
    };

    if (!!commonDecimalPlaces && isNaN(commonDecimalPlaces)) {
      return res.status(400).json({
        status: "Failed",
        message: "please enter valid decimal places for amount.",
      });
    };

    if (quantityDecimalPlaces <= 0 || quantityDecimalPlaces > 3) {
      return res.status(400).json({
        status: "Failed",
        message: "please enter quantity decimal from 1 to 3.",
      });
    } else if (!!quantityDecimalPlaces) {
      payload.quantityDecimalPlaces = quantityDecimalPlaces;
    };

    if (commonDecimalPlaces <= 0 || commonDecimalPlaces > 3) {
      return res.status(400).json({
        status: "Failed",
        message: "please enter common decimal from 1 to 3.",
      });
    } else if (!!commonDecimalPlaces) {
      payload.commonDecimalPlaces = commonDecimalPlaces;
    };

    // let payload = {
    //   //enable-disable tax percent
    //   enableGstPercent: gstTax,
    //   enableVatPercent: vatTax,

    //   //enable-disable inputs
    //   enableItemCode,
    //   enableItemCategory,
    //   enableItemHsn,
    //   enableItemDiscount,
    //   enableItemMrp,

    //   //set decimal places
    //   quantityDecimalPlaces,
    //   commonDecimalPlaces,
    // };
    let updatedItemSettings = await ItemSettings.findOneAndUpdate(
      {
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      },
      payload
    );

    if (!updatedItemSettings) {
      throw new Error(`Error Updating Item Settings`);
    };

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

exports.getItemSettings = async (req, res) => {
  const itemSettings =
    (await ItemSettings.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    })) ||
    new ItemSettings({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });
  try {
    res.status(200).json({
      status: "Success",
      message: "Item Settings Fetched Successfully",
      data: itemSettings,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};

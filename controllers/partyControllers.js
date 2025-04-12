const Party = require("../models/partyModel");

const Transactions = require("../models/transactionModel");

const formatDate = require("../global/formatDate");

exports.getAllPartiesList = async (req, res) => {
  const { limit, skip, search = "" } = req.query;

  try {

    const searchConditions = {
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
      // "contactDetails.phone": { $regex: search, $options: "i" },
    };



    if (search) {

      const regex = new RegExp(search, "i");

      searchConditions.$or = [
        { name: { $regex: regex } },
        // { "contactDetails.email": { $regex: regex } },
        // { "contactDetails.phone": { $regex: regex } },
        // { gstIn: { $regex: regex } }
      ];
    };

    const PartiesList = await Party.find(searchConditions)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select("-_v -createdAt");

    res.status(200).json({ status: "Success", data: PartiesList });
  } catch (error) {
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while fetching the parties. Please try again",
      error: error.message,
    });
  }
};

exports.getPartiesAndBalance = async (req, res) => {
  const { limit, skip, search = "" } = req.query;
  try {

    const parties = await Party.find({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
      // "contactDetails.phone": { $regex: search, $options: "i" },
    })
      .select('name balanceDetails openingBalanceDetails contactDetails')
      .limit(parseInt(limit))
      .skip(parseInt(skip));


    // Calculate partyBalance for each party
    const result = parties.map((party) => {
      const receivableBalance = party.balanceDetails.receivableBalance || 0;
      const payableBalance = party.balanceDetails.payableBalance || 0;
      let partyBalance = receivableBalance - payableBalance;
      const { openingBalance, balanceType } = party.openingBalanceDetails
      partyBalance = balanceType == 'toPay' ? partyBalance - openingBalance : partyBalance + openingBalance;

      const isReceivable = partyBalance >= 0 ? true : false;
      return {
        _id: party._id,
        name: party.name,
        value: party.name,
        label: party.name,
        phoneNo: !party?.contactDetails?.phone ? "" : party?.contactDetails?.phone,
        balance: Math.abs(partyBalance),
        isReceivable,
        address: party.billingAddress ? party.billingAddress : "",
      };


    });
    console.log(result, 'Result')
    res.status(200).json({ status: "Success", data: result });
  } catch (error) {
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while fetching the parties. Please try again",
      error: error.message,
    });
  }
};

exports.addNewParty = async (req, res) => {
  try {
    let {
      name,
      businessType,
      email,
      gstIn,
      gstType,
      phone,
      state,
      billingAddress,
      shippingAddress,
      openingBalance,
      asOfDate,
      balanceType,
      additionalField1,
      additionalField2,
      additionalField3,
      creditLimit
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    };

    state = state ? state : null;
    creditLimit = !creditLimit ? 0 : creditLimit;

    const existingParty = await Party.findOne({
      $or: [{ name: name }, { email: email }],
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    if (existingParty) {
      return res.status(409).json({
        status: "Failed",
        message: "Party with this name or email already exists",
      });
    }

    if (!openingBalance) {
      openingBalance = 0;
    }

    let contactDetails = {
      email,
      phone,
    };

    let openingBalanceDetails = {
      openingBalance,
      date: asOfDate,
      balanceType,
    };

    const addParty = await Party.create({
      name,
      businessType,
      email,
      gstIn,
      gstType,
      creditLimit,
      contactDetails,
      openingBalanceDetails,
      state,
      billingAddress,
      shippingAddress,
      additionalField1,
      additionalField2,
      additionalField3,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    // if (addParty) {
    res.status(201).json({
      status: "Success",
      message: "Party Added Succesfully",
      data: addParty,
    });
    // };

  } catch (error) {
    console.log(error, "Error");
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while Adding the Party. Please try again",
      error: error.message,
    });
  }
};

exports.updateParty = async (req, res) => {
  try {
    const { partyId } = req.params;
    let {
      name,
      email,
      gstIn,
      gstType,
      phone,
      state,
      billingAddress,
      shippingAddress,
      openingBalance,
      asOfDate,
      balanceType,
      additionalField1,
      additionalField2,
      additionalField3,
      creditLimit
    } = req.body;

    let partyExists = await Party.findById(partyId);
    if (!partyExists) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Party not found" });
    }

    state = state ? state : null;

    let contactDetails = {
      email,
      phone,
    };

    if (!openingBalance) {
      openingBalance = 0;
    }

    let openingBalanceDetails = {
      openingBalance,
      date: asOfDate,
      balanceType,
    };
    // console.log(await Party.findOne({_id:partyId,cre}))
    // Update the party details in the database
    const updatedParty = await Party.findOneAndUpdate(
      {
        _id: partyId,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      }, // The ID of the party to update
      {
        name,
        email,
        gstIn,
        gstType,
        contactDetails,
        openingBalanceDetails,
        state,
        billingAddress,
        creditLimit,
        shippingAddress,
        additionalField1,
        additionalField2,
        additionalField3,
      },
      { new: true, runValidators: true }
    );

    if (updatedParty) {
      res.status(200).json({
        status: "Success",
        message: "Party updated successfully",
        data: updatedParty,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while updating the party. Please try again.",
      error: error.message,
    });
  }
};

exports.deleteParty = async (req, res) => {
  try {
    const { partyId } = req.params;

    // Validate if partyId is provided
    if (!partyId) {
      return res
        .status(400)
        .json({ status: "Failed", message: "Party ID is required" });
    }

    const isPartyExist = await Party.findOne({
      _id: partyId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    if (!isPartyExist) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Party Not Found" });
    }

    let isPartyTransactionExist = await Transactions.findOne({
      party: partyId,
    });

    if (isPartyTransactionExist) {
      return res.status(409).json({
        message:
          "This Party can not be deleted as it already has transactions. Please delete all transactions before deleting the party.",
      });
    }

    // Delete the party
    await Party.findOneAndDelete({
      _id: partyId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    res
      .status(200)
      .json({ status: "Success", message: "Party Deleted Successfully" });
  } catch (error) {
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while deleting the Party. Please try again.",
      error: error.message,
    });
  }
};

exports.getTransactionsForParty = async (req, res) => {
  try {
    const { partyId } = req.params;

    const TransactionList = await Transactions.find({
      party: partyId,
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select(
      "transactionType reference.documentId reference.documentNumber transactionDate totalAmount balance -_id"
    );

    const formattedEntries = TransactionList.map((item) => {
      const formattedDate = formatDate(item.transactionDate);

      return {
        ...item._doc,
        totalAmount: parseFloat(item.totalAmount.toFixed(2)),
        balance:
          item.balance == 0 ? "0.00" : parseFloat(item.balance).toFixed(2),
        transactionDate: formattedDate,
      };
    });
    // TransactionList.transactionDate =  formatDate(TransactionList.transactionDate);

    res.status(200).json({
      status: "Success",
      message: "Transaction Fetched Successfully for Party",
      data: formattedEntries,
    });
  } catch (error) {
    res.status(500).json({
      status: "Failed",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getPartyDetailsById = async (req, res) => {
  try {
    const { partyId } = req.params;
    if (!partyId) {
      return res
        .status(400)
        .json({ status: "Failed", error: "Party Id is Required" });
    }

    const PartyDetails = await Party.findById(partyId).select(
      "-createdAt -updatedAt"
    );

    if (!PartyDetails) {
      return res
        .status(404)
        .json({ status: "Failed", message: "Party Not Found" });
    }

    return res.status(200).json({ status: "Success", data: PartyDetails });
  } catch (error) {
    console.log(error);

    res
      .status(500)
      .json({ status: "Failed", message: "Internal Server Error", error });
  }
};

exports.addBulkParties = async (req, res) => {
  try {
    const parties = req.body.parties; // Expecting an array of parties in the request body.

    // Validate request body
    if (!parties || !Array.isArray(parties) || parties.length === 0) {
      return res.status(400).json({
        status: "Failed",
        message: "A non-empty array of parties is required.",
      });
    }

    const errors = [];
    const validParties = [];

    for (const party of parties) {
      let {
        name,
        gstIn,
        gstType,
        email = "",
        phone = "",
        state,
        billingAddress = "",
        shippingAddress = "",
        openingBalance = 0,
        asOfDate = null,
        balanceType, // default to 'toReceive'
        additionalField1 = "",
        additionalField2 = "",
        additionalField3 = "",
      } = party;

      // Validate required fields
      if (!name) {
        errors.push({ party, message: "Name is required." });
        continue;
      }

      state = state ? state : null;

      // Check for existing party by name or email
      const existingParty = await Party.findOne({
        $or: [{ name }, { "contactDetails.email": email }],
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      });

      if (existingParty) {
        errors.push({
          party,
          message: "A party with this name or email already exists.",
        });
        continue;
      }

      // Construct party object
      validParties.push({
        name,
        gstIn,
        gstType,
        contactDetails: { email, phone },
        state,
        billingAddress,
        shippingAddress,
        openingBalanceDetails: {
          openingBalance,
          date: asOfDate,
          balanceType,
        },
        additionalField1,
        additionalField2,
        additionalField3,
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
        // "companyDetails.userId": req.user._id || null,
      });
    }

    // Insert valid parties into the database
    if (validParties.length > 0) {
      await Party.insertMany(validParties);
    }

    res.status(201).json({
      status: "Success",
      message: `${validParties.length} parties added successfully. ${errors.length} parties failed.`,
      data: {
        successfulCount: validParties.length,
        errors,
      },
    });
  } catch (error) {
    console.error("Error in bulk party upload:", error);
    res.status(500).json({
      status: "Failed",
      message: "An error occurred while adding bulk parties. Please try again.",
      error: error.message,
    });
  }
};

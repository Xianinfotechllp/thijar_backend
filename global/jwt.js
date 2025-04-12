const jwt = require("jsonwebtoken");
require("dotenv").config();
const secret = process.env.JWT_SECRET;
const BusinessProfile = require("../models/businessProfile");
const printSettings = require("../models/printSettingsModel");
const itemSettings = require("../models/settings/itemSettings.Model");
const taxSettings = require("../models/settings/taxSettings.Modal");
const Users = require("../models/UserModel");
const SeriesNumber = require("../models/seriesnumber");
const Godowns = require("../models/stockTransfer/godownModel");
const Companies = require("../models/company/companyModel");
const mongoose = require("mongoose");

const validateUserPrefix = async (req, res, next) => {
  try {
    //Fetching Prefix For the logged-in User
    let data = await SeriesNumber.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    let userId =
      req.userRole?.toLowerCase() == "admin" ? req.user : req.currentUser;

    const userPrefix = data.prefixes.find(
      (p) => p.userId.toString() == userId.toString()
    );

    // if (!userPrefix) {
    //   return res.status(404).json({
    //     message: "No prefix found for this user. Add Prefix First...",
    //   });
    // }

    // Attach Prefix to req object
    req.prefix = userPrefix?.prefix || "";
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Token is not valid" });
  }
};

const generateToken = (user, companies, companyId, role) => {
  // console.log(companyId, user.companies[0], 'user.companies[0]')

  console.log(companies)
  const selectedCompanyId =
    companyId || companies.find((company) => company.IsSelected)?.["_id"];

  let userRole = user?.userRole ? user?.userRole : user.role;

  let mainUser;
  if (!selectedCompanyId) {
    throw new Error("No selected company found");
  }

  console.log(mainUser,'mainUser')
  userRole == "Admin" ? (mainUser = user._id) : (mainUser = user.createdBy);
  // return;
  // Old Logic befpre multi user/sync-share
  // return jwt.sign({ id: user._id, phoneNo: user.phoneNo, isClient: user.isClient, companyId: selectedCompanyId }, secret);
  return jwt.sign(
    {
      id: mainUser,
      phoneNo: user.phoneNo,
      isClient: user.isClient,
      companyId: selectedCompanyId,
      userRole,
      currentUser: userRole == "Admin" ? null : user._id,
    },
    secret
  );
};

// Middleware to protect routes
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded.id;
    req.companyId = decoded.companyId;
    req.phoneNo = decoded.phoneNo;
    req.userRole = decoded.userRole;
    req.currentUser = decoded.currentUser;

    // Fetch business profile associated with the user
    const businessProfile = await BusinessProfile.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    }).select("-createdAt -updatedAt -createdBy -__v");
    const PrintSettings = await printSettings.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

    const ItemSettings = await itemSettings.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });
    const TaxSettings =
      (await taxSettings.findOne({
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      })) ||
      new taxSettings({
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
      });


    const MainGodown = await Godowns.findOne({
      createdBy: new mongoose.Types.ObjectId(req.user),
      companyId: new mongoose.Types.ObjectId(req.companyId),
      isMain: true
    });


    // Attach business profile to req object
    req.businessProfile = businessProfile;
    req.printSettings = PrintSettings;
    req.taxSettings = TaxSettings;
    req.itemSettings = ItemSettings;
    req.mainGodownId = MainGodown?._id;
    next();
  } catch (error) {
    console.log(error, "Error");
    res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = { generateToken, verifyToken, validateUserPrefix };

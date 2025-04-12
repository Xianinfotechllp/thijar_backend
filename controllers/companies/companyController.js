const Companies = require("../../models/company/companyModel");
// const SubUsers = require("../../models/company/subUsersModel");
const BusinessProfile = require("../../models/businessProfile");
const Units = require("../../models/unitModel");
const ItemSettings = require("../../models/settings/itemSettings.Model");
const PrintSettings = require("../../models/printSettingsModel");
const GeneralSettings = require("../../models/settings/generalSettingsModel");
const Users = require("../../models/UserModel");
const SeriesNumber = require("../../models/seriesnumber");
const mongoose = require("mongoose");
const Godowns = require("../../models/stockTransfer/godownModel")
const jwt = require('jsonwebtoken');
require("dotenv").config();


const secret = process.env.JWT_SECRET;
const { generateToken } = require('../../global/jwt');

exports.setCompanyId = async (req, res, next) => {
    const { companyId } = req.body;
    if (!companyId) {
        return res.status(400).json({ message: 'companyId is required' });
    };

    try {
        // Validate the companyId
        const businessProfile = await BusinessProfile.findOne({
            'companyDetails.companyId': companyId,
            createdBy: req.user, // Make sure the company belongs to this user
        });

        if (!businessProfile) {
            return res.status(404).json({ message: 'Company not found or not accessible by this user' });
        };

        //Before selecting the given company ,unselecting all the companies first
        let updateAllCompanies = await Companies.updateMany(
            { createdBy: req.user },
            { $set: { IsSelected: false } }
        );

        if (!updateAllCompanies) {
            return res.status(404).json({ message: 'Failed to Update the status of all companies' });
        };

        // Select the given company
        let updateSelectedCompany = await Companies.findOneAndUpdate(
            { _id: companyId, createdBy: req.user },
            { $set: { IsSelected: true } },
            { new: true }
        );

        if (!updateSelectedCompany) {
            return res.status(404).json({ message: 'Company not found or not accessible by this user' });
        }

        let companiesList = await Companies.find({ _id: companyId, createdBy: req.user });

        // Generate new token with updated companyId
        const newToken = generateToken(
            { _id: req.user, isClient: req.isClient, role: "Admin" },
            companiesList,
            companyId
        );

        // Send updated token back to client
        res.setHeader('Authorization', `Bearer ${newToken}`);
        req.companyId = companyId;

        res.status(200).json({ message: 'Company selected successfully', companyId, token: newToken });
   
    } catch (error) {
        console.log(error, 'Errors')
        res.status(500).json({ message: 'Error setting companyId', error: error.message || error });
    }
};


exports.getMyCompanies = async (req, res) => {
    try {

        const companyList = await Companies.find({ createdBy: req.user }).select('-createdAt -updatedAt -users');

        res.status(200).json({ status: 'Success', data: companyList });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });

    }
}

exports.addNewCompany = async (req, res) => {
    let session = await mongoose.startSession();
    session.startTransaction();
    try {

        let { companyName, phoneNo, email } = req.body


        if (!companyName) {
            return res.status(400).json({ status: "Failed", message: 'Company Name is required' })
        };

        let newCompany = await Companies.create([{ companyName, phoneNo, IsSelected: false, email, createdBy: req.user }], { session });

        if (!newCompany || !newCompany[0]) {
            throw new Error("Failed to create New Company");
        };

        const predefinedUnits = [
            { name: 'Kilogram', shortName: 'Kg', createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: 'Liter', shortName: 'L', createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: 'Piece', shortName: 'Pc', createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Square Feet", shortName: "Sqf", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Rolls", shortName: "Rol", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Pairs", shortName: "Prs", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Pieces", shortName: "Pcs", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Meters", shortName: "Mtr", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Millilitre", shortName: "Ml", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Litre", shortName: "Ltr", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Kilograms", shortName: "Kg", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Grams", shortName: "Gm", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Dozens", shortName: "Dzn", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Cartons", shortName: "Ctn", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Cans", shortName: "Can", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Bottles", shortName: "Btl", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Box", shortName: "Box", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Bags", shortName: "Bag", createdBy: req.user, 'companyDetails.companyId': newCompany[0]._id }
        ];

        // Create a business profile
        const newBusinessProfile = await BusinessProfile.create([{
            businessName: companyName,
            phoneNo,
            email,
            createdBy: req.user,
            'companyDetails.companyId': newCompany[0]._id
        }], { session });

        if (!newBusinessProfile || !newBusinessProfile[0]) {
            throw new Error("Failed to create Business Profile");
        };

        // // Update company's businessProfileId
        newCompany[0].businessProfileId = newBusinessProfile[0]._id;
        await newCompany[0].save({ session });



        //Creating main godown for the company
        await Godowns.create([{
            name: 'Main Godown',
            companyId: newCompany[0]._id,
            createdBy: req.user,
            isMain: true
        }], { session });

        // // Create predefined units for the user
        // // Save the predefined units
        await Units.insertMany(predefinedUnits, { session });

        // After the user is registered, create a new series number entry for them
        const newSeries = new SeriesNumber({
            createdBy: req.user,
            'companyDetails.companyId': newCompany[0]._id
        });

        // Save the series number entry
        const savedSeries = await newSeries.save({ session });

        if (!savedSeries) {
            throw new Error('Failed to Save SeriesNumber')
        };

        const newGeneralSettings = await GeneralSettings.create([{ 'companyDetails.companyId': newCompany[0]._id, createdBy: req.user }], { session });

        if (!newGeneralSettings) {
            throw new Error('Failed to Save General Settings');
        };

        const newItemSettings = await ItemSettings.create([{
            createdBy: req.user,
            'companyDetails.companyId': newCompany[0]._id
        }], { session });

        if (!newItemSettings) {
            throw new Error('Failed to Save Item Settings')
        }

        const newPrintSettings = await PrintSettings.create([{ 'companyDetails.companyId': newCompany[0]._id, createdBy: req.user }], { session })

        if (!newPrintSettings) {
            throw new Error('Failed to Save Print Settings')
        };

        const updateUserCompanyList = await Users.findByIdAndUpdate(req.user, {
            $push: { companies: newCompany[0]._id }
        }, { new: true, session });

        await session.commitTransaction();

        res.status(201).json({
            status: "Success", message: "Company Created Successfully"
        });


    } catch (error) {
        await session.abortTransaction()
        res.status(500).json({ message: "Internal Server Error", error: error.message || error });
    } finally {
        await session.endSession()
    }
}






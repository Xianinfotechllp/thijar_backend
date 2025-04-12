const mongoose = require('mongoose');
const Users = require("../../models/UserModel");
const SubUsers = require("../../models/company/subUsersModel");
const Otps = require("../../models/otpsModel")
const Units = require("../../models/unitModel");
const SeriesNumber = require("../../models/seriesnumber");
const { generateToken } = require('../../global/jwt');
const BusinessProfile = require('../../models/businessProfile');
//Settings Model:-
const GeneralSettings = require('../../models/settings/generalSettingsModel');
const PrintSettings = require('../../models/printSettingsModel');
const ItemSettings = require('../../models/settings/itemSettings.Model');

const Companies = require("../../models/company/companyModel");
const Godowns = require("../../models/stockTransfer/godownModel")
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const sendSms = require("../../utils/sendSms")

exports.generateOTP = async (req, res) => {
    try {


        const { phoneNo } = req.body;
        const otpCode = crypto.randomInt(100000, 999999).toString(); //  6-digit Otp
        const otpExpiration = new Date(Date.now() + 5 * 60 * 1000); // Making it Expire in 5 minutes


        await Otps.deleteMany({phoneNo});

        // Hash Otp for security
        const hashedOtp = await bcrypt.hash(otpCode, 10);


        // Create a new Otp entry
        const newOtp = new Otps({
            phoneNo,
            otpCode: hashedOtp,
            otpExpiration,
            isVerified: false,
        });
        await newOtp.save();

        // console.log(phoneNo, 'Phone to check');
        // console.log(otpCode, 'Otp-Code to check');
        await sendSms(otpCode, phoneNo);
        // await sendSms(123456, phoneNo);

        console.log(`Otp sent to ${phoneNo}: ${otpCode}`);

        return res.status(200).json({ message: `Otp sent to ${phoneNo} Successfully` })
    }
    catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message || error })
    }
};

function removeCountryCode(phoneNo, countryCodeLength = 2) {
    // return phoneNo.startsWith('+') ? phoneNo.slice(countryCodeLength + 1) : phoneNo;

    phoneNo = String(phoneNo);
    return phoneNo.charAt(0) === '+' ? phoneNo.substring(countryCodeLength + 1) : phoneNo;
};

function getCountryCode(phoneNumber) {
    const match = phoneNumber.match(/^(\+\d{1,4})/);
    return match ? match[1] : null;
}

exports.verifyOtpAndRegisterUser = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { phoneNo, otp } = req.body;

        if (!phoneNo || !otp) {
            return res.status(400).json({ error: "All fields are required" });
        };

        // Fetch OTP entry from the database
        const otpEntry = await Otps.findOne({ phoneNo });
        // console.log(phoneNo, req.body, "Phone No during registraton")
        // console.log(otpEntry, "otps");

        if (!otpEntry) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        };

        // Check if OTP matches and is not expired
        const isOtpValid = await bcrypt.compare(otp, otpEntry.otpCode);
        if (!isOtpValid || otpEntry.otpExpiration < new Date()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        };

        // Delete OTP entry after successful verification
        await Otps.deleteOne({ phoneNo });

        // Check if user already exists

        const isUserExists = await Users.findOne({ phoneNo: removeCountryCode(phoneNo) });
        if (isUserExists) {
            return res.status(409).json({ status: "Failed", message: "User with same Phone No. already exists" });
        };

        // Create new user
        const newUser = await Users.create([{ phoneNo: removeCountryCode(phoneNo), countryCode: getCountryCode(phoneNo).slice(0, 3) }], { session });
        if (!newUser || !newUser[0]) {
            throw new Error("Error in saving new User");
        };

        let newCompany = await Companies.create([{ companyName: "", phoneNo: removeCountryCode(phoneNo), email: "", IsSelected: true, createdBy: newUser[0]._id }], { session });
        if (!newCompany || !newCompany[0]) {
            throw new Error("Failed to create New Company");
        };

        const newBusinessProfile = await BusinessProfile.create([{ createdBy: newUser[0]._id, phoneNo: removeCountryCode(phoneNo), 'companyDetails.companyId': newCompany[0]._id }], { session });
        if (!newBusinessProfile || !newBusinessProfile[0]) {
            throw new Error("Failed to create Business Profile");
        }

        newUser[0].businessProfileId = newBusinessProfile[0]._id;
        newCompany[0].businessProfileId = newBusinessProfile[0]._id;
        newUser[0].companies.push(newCompany[0]._id);

        await newUser[0].save({ session });
        await newCompany[0].save({ session });

        let mainGodown = await Godowns.create([{ name: 'Main Godown', companyId: newCompany[0]._id, createdBy: newUser[0]._id, isMain: true }], { session });

        // Create predefined units for the user
        const predefinedUnits = [
            { name: 'Kilogram', shortName: 'Kg', createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: 'Liter', shortName: 'L', createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: 'Piece', shortName: 'Pc', createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Square Feet", shortName: "Sqf", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Rolls", shortName: "Rol", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Pairs", shortName: "Prs", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Pieces", shortName: "Pcs", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Packs", shortName: "Pac", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Meters", shortName: "Mtr", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Millilitre", shortName: "Ml", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Numbers", shortName: "Nm", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Litre", shortName: "Ltr", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Kilograms", shortName: "Kg", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Grams", shortName: "Gm", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Dozens", shortName: "Dzn", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Cartons", shortName: "Ctn", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Cans", shortName: "Can", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Bottles", shortName: "Btl", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Box", shortName: "Box", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Bags", shortName: "Bag", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id }
        ];
        await Units.insertMany(predefinedUnits, { session });

        // Create series number entry
        const newSeries = new SeriesNumber({ createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id });
        const savedSeries = await newSeries.save({ session });
        if (!savedSeries) throw new Error('Failed to Save SeriesNumber');

        // Create settings
        const newGeneralSettings = await GeneralSettings.create([{ createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id }], { session });
        if (!newGeneralSettings) throw new Error('Failed to Save General Settings');

        const newPrintSettings = await PrintSettings.create([{ createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id }], { session });
        if (!newPrintSettings) throw new Error('Failed to Save Print Settings');

        const newItemSettings = await ItemSettings.create([{ createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id }], { session });
        if (!newItemSettings) throw new Error('Failed to Save Item Settings');

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        let companiesList = await Companies.find({ createdBy: newUser[0]._id });
        const token = generateToken(newUser[0], companiesList);

        res.status(201).json({
            status: "Success",
            message: "User Registered Successfully",
            data: {
                token,
                user: {
                    id: newUser[0]._id,
                    details: newUser[0]
                },
                itemSettings: newItemSettings
            }
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(error);
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    }
};

exports.verifyOtpAndLogin = async (req, res) => {
    try {
        const { phoneNo, otp } = req.body;

        if (!phoneNo || !otp) {
            return res.status(400).json({ error: "All fields are required" });
        };

        // Fetch OTP entry from the database
        const otpEntry = await Otps.findOne({ phoneNo });

        if (!otpEntry) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        };

        // Check if OTP matches and is not expired
        const isOtpValid = await bcrypt.compare(otp, otpEntry.otpCode);
        if (!isOtpValid || otpEntry.otpExpiration < new Date()) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        };

        // Delete OTP entry after successful verification
        await Otps.deleteOne({ phoneNo });

        // Check if the user exists
        const user = await Users.findOne({ phoneNo: removeCountryCode(phoneNo) });

        if (!user) {
            return res.status(404).json({
                status: 404,
                message: "User not found",
            });
        };

        const userDetails = await Users.findOne({ _id: user._id });

        const { lastLoginAs } = user;

        // Check lastLoginAs and log in accordingly
        if (lastLoginAs) {
            const { role, companyId } = lastLoginAs;

            if (role === "subUser") {
                const subUser = await SubUsers.findOne({ userId: user._id.toString(), companyId });

                if (subUser && subUser.status === "Accepted") {
                    const company = await Companies.findById(companyId);
                    const token = generateToken(subUser, [company]);


                    let existingItemSettings = await ItemSettings.findOne({
                        createdBy: subUser.createdBy, 'companyDetails.companyId': companyId
                    });

                    return res.status(200).json({
                        message: "Login Successful (SubUser)",
                        data: {
                            token,
                            user: {
                                id: user._id,
                                businessName: user.businessName,
                                details: userDetails
                            },
                            itemSettings: existingItemSettings
                        },
                    });
                }
            };
        };

        let companiesList = await Companies.find({ createdBy: user._id });

        // Generate JWT token
        const token = generateToken(user, companiesList);

        let selectedCompanyId = companiesList.find(company => company.IsSelected)?.["_id"];

        let existingSetting = await GeneralSettings.findOne({ createdBy: user._id });

        if (!existingSetting) {

            const newGeneralSettings = await GeneralSettings.create([{ createdBy: user._id }]);

            if (!newGeneralSettings) {
                throw new Error('Failed to Save General Settings');
            };

            const newPrintSettings = await PrintSettings.create([{ createdBy: user._id }])

            if (!newPrintSettings) {
                throw new Error('Failed to Save Print Settings')
            };
        };

        let existingBusinessProfile = await BusinessProfile.findOne({ createdBy: userDetails._id });

        if (!existingBusinessProfile) {
            // Create a business profile
            const newBusinessProfile = await BusinessProfile.create([{
                createdBy: user._id,
            }]);

            if (!newBusinessProfile || !newBusinessProfile[0]) {
                throw new Error("Failed to create Business Profile");
            }

            userDetails.businessProfileId = newBusinessProfile[0]._id;
            await userDetails.save();
        };

        //Checking or Editing Item Settings
        let existingItemSettings = await ItemSettings.findOne({
            createdBy: userDetails._id, 'companyDetails.companyId': selectedCompanyId

        });

        if (!existingItemSettings) {
            // Create Item Settings
            let newItemSettings = await ItemSettings.create({ createdBy: userDetails._id });

            if (!newItemSettings) {
                throw new Error('Failed to Save Item Settings!!');
            };
            existingItemSettings = newItemSettings;
        };

        res.status(200).json({
            status: 200,
            message: "Login Successful",
            data: {
                token,
                user: {
                    id: user._id,
                    businessName: user.businessName,
                    details: userDetails
                },
                itemSettings: existingItemSettings
            },
        });

    } catch (error) {
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    }
}


// exports.verifyOtpAndRegisterUser = async (req, res) => {
//     try {
//         const { phoneNo, otp } = req.body;

//         if (!phoneNo || !otp) {
//             return res.status(400).json({ error: "All fields are required" });
//         };

//         // Fetch Otp entry from the database
//         const otpEntry = await Otps.findOne({ phoneNo });

//         if (!otpEntry) {
//             return res.status(400).json({ error: "Invalid or expired Otp" });
//         }

//         // Check if Otp matches and is not expired
//         const isOtpValid = await bcrypt.compare(otp, otpEntry.otpCode);
//         if (!isOtpValid || otpEntry.otpExpiration < new Date()) {
//             return res.status(400).json({ error: "Invalid or expired Otp" });
//         }
//         res.status(200).json({ Message: 'Otp Verified SUccessfully' })
//         // // Proceed to register user
//         // const hashedPassword = await bcrypt.hash(password, 10);
//         // const newUser = new Users({
//         //     phoneNo,
//         //     email,
//         //     passCode: hashedPassword,
//         //     isPhoneNoVerified: true,
//         // });
//         // await newUser.save();

//         // // Mark the Otp as used or delete it
//         // await Otps.deleteOne({ phoneNo });

//         // return res.status(201).json({
//         //     message: "User registered successfully",
//         //     user: {
//         //         id: newUser._id,
//         //         phoneNo: newUser.phoneNo,
//         //         email: newUser.email,
//         //     },
//         // });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ message: "An error occurred", error: error.message || error });
//     }
// };

// module.exports = { registerWithOtp };


exports.registerUser = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        let { phoneNo } = req.body;

        if (!phoneNo || phoneNo.length < 10) {
            return res.status(400).json({ status: 'Failed', message: "Enter Valid Phone No." });
        };

        // Check if user already exists
        const isUserExists = await Users.findOne({ phoneNo });
        if (isUserExists) {
            return res.status(409).json({ status: "Failed", message: "User with same Phone No. already exists" });
        };

        // Create the new user
        const newUser = await Users.create([{
            phoneNo,
            countryCode: ''
        }], { session }); // Include session for atomicity

        if (!newUser || !newUser[0]) {
            throw new Error("Error in saving new User");
        };

        let newCompany = await Companies.create([{ companyName: "", phoneNo, email: "", IsSelected: true, createdBy: newUser[0]._id }], { session });

        if (!newCompany || !newCompany[0]) {
            throw new Error("Failed to create New Company");
        };

        // Create a business profile
        const newBusinessProfile = await BusinessProfile.create([{
            createdBy: newUser[0]._id,
            phoneNo,
            'companyDetails.companyId': newCompany[0]._id
        }], { session });

        if (!newBusinessProfile || !newBusinessProfile[0]) {
            throw new Error("Failed to create Business Profile");
        };

        // Update user's businessProfileId 
        newUser[0].businessProfileId = newBusinessProfile[0]._id;
        newCompany[0].businessProfileId = newBusinessProfile[0]._id;
        newUser[0].companies.push(newCompany[0]._id);

        await newUser[0].save({ session });
        await newCompany[0].save({ session });

        //Creating main godown for the company
        let mainGodown = await Godowns.create([{
            name: 'Main Godown',
            companyId: newCompany[0]._id,
            createdBy: newUser[0]._id,
            isMain: true
        }], { session });


        // Create predefined units for the user
        const predefinedUnits = [
            { name: 'Kilogram', shortName: 'Kg', createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: 'Liter', shortName: 'L', createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: 'Piece', shortName: 'Pc', createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Square Feet", shortName: "Sqf", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Rolls", shortName: "Rol", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Pairs", shortName: "Prs", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Pieces", shortName: "Pcs", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Packs", shortName: "Pac", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Meters", shortName: "Mtr", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Millilitre", shortName: "Ml", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Numbers", shortName: "Nm", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Litre", shortName: "Ltr", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Kilograms", shortName: "Kg", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Grams", shortName: "Gm", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Dozens", shortName: "Dzn", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Cartons", shortName: "Ctn", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Cans", shortName: "Can", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Bottles", shortName: "Btl", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Box", shortName: "Box", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id },
            { name: "Bags", shortName: "Bag", createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id }
        ];

        // Save the predefined units
        await Units.insertMany(predefinedUnits, { session });

        // After the user is registered, create a new series number entry for them
        const newSeries = new SeriesNumber({
            createdBy: newUser[0]._id,
            'companyDetails.companyId': newCompany[0]._id
        });

        // Save the series number entry
        const savedSeries = await newSeries.save({ session });

        if (!savedSeries) {
            throw new Error('Failed to Save SeriesNumber');
        };

        const newGeneralSettings = await GeneralSettings.create([{ createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id }], { session });

        if (!newGeneralSettings) {
            throw new Error('Failed to Save General Settings');
        };

        const newPrintSettings = await PrintSettings.create([{ createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id }], { session })

        if (!newPrintSettings) {
            throw new Error('Failed to Save Print Settings');
        };

        const newItemSettings = await ItemSettings.create([{ createdBy: newUser[0]._id, 'companyDetails.companyId': newCompany[0]._id }], { session });

        if (!newItemSettings) {
            throw new Error('Failed to Save Item Settings');
        };

        // Commit the transaction if all goes well
        await session.commitTransaction();
        session.endSession();

        let companiesList = await Companies.find({ createdBy: newUser[0]._id });

        const token = generateToken(newUser[0], companiesList);

        res.status(201).json({
            status: "Success",
            message: "User Registered Successfully",
            data: {
                token,
                user: {
                    id: newUser[0]._id,
                    details: newUser[0]
                },
                itemSettings: newItemSettings

                // id: newUser[0]._id,
                // businessProfileId: newBusinessProfile[0]._id,
                // phoneNo: newUser[0].phoneNo,
            }
        });
    } catch (error) {
        // Abort the transaction in case of an error
        await session.abortTransaction();
        session.endSession();
        console.error(error);
        res.status(500).json({
            status: "Failed",
            message: "Internal Server Error",
            error: error.message || error
        });
    }
};


exports.loginUser = async (req, res) => {
    try {
        const { phoneNo } = req.body;
        // Validate input
        if (!phoneNo) {
            return res.status(400).json({
                status: 400,
                message: "Phone Number is required",
            });
        }

        // Check if the user exists
        const user = await Users.findOne({ phoneNo });

        if (!user) {
            return res.status(404).json({
                status: 404,
                message: "User not found",
            });
        };

        const userDetails = await Users.findOne({ _id: user._id });


        const { lastLoginAs } = user;

        // Check lastLoginAs and log in accordingly
        if (lastLoginAs) {
            const { role, companyId } = lastLoginAs;

            if (role === "subUser") {
                console.log(user._id.toString(), companyId)
                const subUser = await SubUsers.findOne({ userId: user._id.toString(), companyId });

                if (subUser && subUser.status === "Accepted") {
                    const company = await Companies.findById(companyId);
                    const token = generateToken(subUser, [company]);


                    let existingItemSettings = await ItemSettings.findOne({
                        createdBy: subUser.createdBy, 'companyDetails.companyId': companyId
                    });

                    return res.status(200).json({
                        message: "Login Successful (SubUser)",
                        data: {
                            token,
                            user: {
                                id: user._id,
                                businessName: user.businessName,
                                details: userDetails
                            },
                            itemSettings: existingItemSettings
                        },
                        // data: {
                        //     token,
                        // selectedCompany: {
                        //     ...company.toObject(),
                        //     role: subUser.role || "Salesman",
                        // },
                        // },
                    });
                }
            };
        }



        let companiesList = await Companies.find({ createdBy: user._id });


        console.log(companiesList, 'companies list')
        // Generate JWT token
        const token = generateToken(user, companiesList);

        let selectedCompanyId = companiesList.find(company => company.IsSelected)?.["_id"];

        // console.log(selectedCompanyId, 'Diko')

        let existingSetting = await GeneralSettings.findOne({ createdBy: user._id });


        if (!existingSetting) {

            const newGeneralSettings = await GeneralSettings.create([{ createdBy: user._id }]);

            if (!newGeneralSettings) {
                throw new Error('Failed to Save General Settings');
            };

            const newPrintSettings = await PrintSettings.create([{ createdBy: user._id }])

            if (!newPrintSettings) {
                throw new Error('Failed to Save Print Settings')
            };
        };


        let existingBusinessProfile = await BusinessProfile.findOne({ createdBy: userDetails._id });

        if (!existingBusinessProfile) {
            // Create a business profile
            const newBusinessProfile = await BusinessProfile.create([{
                createdBy: user._id,
            }]);

            if (!newBusinessProfile || !newBusinessProfile[0]) {
                throw new Error("Failed to create Business Profile");
            }

            userDetails.businessProfileId = newBusinessProfile[0]._id;
            await userDetails.save();
        };

        //Checking or Editing Item Settings
        let existingItemSettings = await ItemSettings.findOne({
            createdBy: userDetails._id, 'companyDetails.companyId': selectedCompanyId

        });

        if (!existingItemSettings) {
            // Create Item Settings
            let newItemSettings = await ItemSettings.create({ createdBy: userDetails._id });

            if (!newItemSettings) {
                throw new Error('Failed to Save Item Settings!!');
            };
            existingItemSettings = newItemSettings;
        };





        res.status(200).json({
            status: 200,
            message: "Login Successful",
            data: {
                token,
                user: {
                    id: user._id,
                    businessName: user.businessName,
                    details: userDetails
                },
                itemSettings: existingItemSettings
            },
        });

    } catch (error) {
        console.log(error, 'Error')
        res.status(500).json({
            status: 500,
            message: "An unexpected error occurred. Please try again later.",
            data: error || error.message,
        });
    }
};

// Auth.js
exports.logoutUser = async (req, res) => {
    try {
        res.status(200).json({
            status: 200,
            message: "User logged out successfully",
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "An error occurred while logging out",
            error: error.message || error,
        });
    }
};


exports.editFirm = async (req, res) => {
    try {

        const { businessName, gstIn, phoneNo, email, address, businessType, pinCode, businessCategory, state, description } = req.body;


        const existingUser = await Users.findById(req.user);


        if (!existingUser) {
            return res.status(404).json({ status: 'Failed', message: "User Not FOund" });
        };


        let logo, signature = '';

        if (req.files) {

            logo = req.files['logo'] ? req.files['logo'][0].filename : '';
            signature = req.files['signature'] ? req.files['signature'][0].filename : '';

        }



        if (!email && !phoneNo) {
            return res.status(400).json({ status: "Failed", message: "Atleast one of Phone or email are required" })
        }


        if (gstIn && gstIn.length != 15) {
            return res.status(400).json({ status: "Failed", message: `GSTIN is not  valid` })

        }

        if (pinCode && pinCode.length != 6) {
            return res.status(400).json({ status: "Failed", message: `Pin Code is not valid` })

        };

        existingUser.email = email
        existingUser.phoneNo = phoneNo
        existingUser.businessName = businessName
        existingUser.gstIn = gstIn
        existingUser.logo = logo
        existingUser.businessDetails.businessAddress = address
        existingUser.businessDetails.businessType = businessType
        existingUser.businessDetails.businessCategory = businessCategory
        existingUser.businessDetails.businessDescription = description
        existingUser.businessDetails.pincode = pinCode
        existingUser.businessDetails.state = state
        existingUser.businessDetails.signature = signature

        await existingUser.save()
        res.status(200).json({
            status: 200,
            message: "Firm Updated Successfully",
            businessFirmUpdatedSuccessfull
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "An error occurred while logging out",
            error: error.message || error,
        });
    }
}
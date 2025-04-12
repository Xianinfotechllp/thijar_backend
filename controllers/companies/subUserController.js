const Companies = require("../../models/company/companyModel");
const SubUser = require("../../models/company/subUsersModel"); // Sub-user schema
const User = require("../../models/UserModel");
const SeriesNumber = require("../../models/seriesnumber");
const mongoose = require("mongoose");
const { generateToken } = require("../../global/jwt");



exports.getAllSubUsers = async (req, res) => {

  try {
    const UserList = await SubUser.find({ createdBy: req.user }).select('-createdAt -updatedAt -createdBy');

    res.status(200).json({ status: "Success", data: !UserList.length ? "No users have been added to the company yet." : UserList });
  } catch (error) {
    res.status(500).json({ error: error.message || error })
  }
};


// Add a new sub-user
exports.addSubUser = async (req, res) => {
  const { phoneNo, userName, userRole, prefix } = req.body;
  const createdBy = req.user;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // console.log(req.body, phoneNo, 'Data')

    // Check if user already exists. For now Im Considering Phone no. only...
    const existingUser = await User.findOne({ phoneNo: phoneNo });

    if (!existingUser) {
      return res
        .status(404)
        .json({ message: "The phone number is not registered." });
    }

    const series = await SeriesNumber.findOne({
      createdBy: existingUser._id,
    });

    // console.log(series, "Series");
    // return res.status(409).json({ message: series, id: existingUser._id });

    series.prefixes[0] = {
      userId: existingUser._id,
      prefix,
    };
    await series.save();

    // Check if sub-user already exists for the company
    const existingSubUser = await SubUser.findOne({
      companyId: req.companyId,
      phoneNo,
    });

    if (existingSubUser) {
      return res
        .status(409)
        .json({ message: "Sub-user already added for this company" });
    }

    // Create the sub-user
    const subUser = new SubUser({
      companyId: req.companyId,
      userId: existingUser._id,
      phoneNo,
      userName,
      userRole,
      createdBy,
      prefix,
    });

    await subUser.save({ session });
    const company = await Companies.findById(subUser.companyId);

    if (!company) {
      return res.status(404).json({ message: "Company not found." });
    }

    company.users.push(subUser._id);
    await company.save({ session });

    await session.commitTransaction();

    res.status(201).json({ message: "User Added Successfully", subUser });
  } catch (error) {
    await session.abortTransaction();
    res
      .status(500)
      .json({ message: "Error adding sub-user", error: error.message });
  } finally {
    session.endSession();
  }
};

exports.getPendingRequests = async (req, res) => {
  const phoneNo = req.phoneNo; // Assume the sub-user is authenticated

  // console.log(phoneNo, req.businessProfile)

  try {
    const pendingRequests = await SubUser.find({ phoneNo })
      .populate("companyId", "companyName phoneNo") // Fetch company details
      .exec();

    res.status(200).json({ pendingRequests });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching requests", error: error.message });
  }
};

// Approve the sub-user request
exports.approveRequest = async (req, res) => {
  const { requestId } = req.body;
  const userId = req.user; // Assume sub-user is authenticated

  try {
    const request = await SubUser.findOneAndUpdate(
      { _id: requestId, userId, status: "Pending" },
      { status: "Accepted" },
      { new: true }
    );

    if (!request) {
      return res
        .status(404)
        .json({ message: "Request not found or already processed" });
    }

    res.status(200).json({ message: "Request approved successfully", request });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error approving request", error: error.message });
  }
};

exports.switchToCompany = async (req, res) => {
  try {
    const { companyId } = req.body;

    const userId = req.user;

    if (!userId || !companyId) {
      return res
        .status(400)
        .json({ message: "User ID and Company ID are required" });
    }

    // Find the company by ID
    const company = await Companies.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // First, check if the user is a subuser for the company
    const subUser = await SubUser.findOne({ userId, companyId });

    if (subUser && subUser.status == "Accepted") {
      // User is a subuser (e.g., Salesman)

      //Here im passing the companies of the company

      // Update lastLoginAs
      await User.findByIdAndUpdate(userId, {
        lastLoginAs: { role: "subUser", companyId },
      });

      const token = generateToken(subUser, [company]);
      // return

      return res.status(200).json({
        message: "Switched company successfully (Subuser)",
        data: {
          token,
          selectedCompany: {
            ...company.toObject(),
            role: subUser.role || "Salesman",
          },
        },
      });
    }

    // return
    //Will check this logic later
    // // Check if the user is the default admin (owner)
    // const user = await Users.findById(userId);
    // if (!user) {
    //     return res.status(404).json({ message: "User not found" });
    // }

    // if (company.createdBy.toString() === user._id.toString()) {
    //     // User is the admin of the company
    //     const token = generateToken({
    //         userId,
    //         selectedCompanyId: companyId,
    //         role: "Admin",
    //     });

    //     return res.status(200).json({
    //         message: "Switched company successfully (Admin)",
    //         data: {
    //             token,
    //             selectedCompany: {
    //                 ...company.toObject(),
    //                 role: "Admin",
    //             },
    //         },
    //     });
    // }

    // // If not a subuser or admin
    return res.status(403).json({
      message:
        "User not associated with this company or not approved the join request yet.",
    });
  } catch (error) {
    res.status(500).json({ message: "An error occurred", error });
  }
};

// exports.updateSubUser = async (req, res) => {
//   const { subUserId } = req.params;
//   const { phoneNo, userName, userRole, prefix } = req.body;
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     // Find the existing sub-user
//     const subUser = await SubUser.findById(subUserId).session(session);
//     if (!subUser) {
//       return res.status(404).json({ message: "Sub-user not found." });
//     }

//     // Find the associated user
//     // checking through phonno so not allowing to edit it
//     const existingUser = await User.findOne({ phoneNo: phoneNo }).session(
//       session
//     );
//     if (!existingUser) {
//       return res
//         .status(404)
//         .json({ message: "The phone number is not registered." });
//     }

//     // Update the series prefix
//     const series = await SeriesNumber.findOne({
//       createdBy: existingUser._id,
//     }).session(session);
//     if (series) {
//       series.prefixes[0] = {
//         userId: existingUser._id,
//         prefix,
//       };
//       await series.save({ session });
//     }

//     // Update sub-user details
//     subUser.userId = existingUser._id;
//     subUser.phoneNo = phoneNo;
//     subUser.userName = userName;
//     subUser.userRole = userRole;
//     subUser.prefix = prefix;

//     await subUser.save({ session });

//     // Update company user association
//     const company = await Companies.findById(subUser.companyId).session(
//       session
//     );
//     if (!company) {
//       return res.status(404).json({ message: "Company not found." });
//     }

//     if (!company.users.includes(subUser._id)) {
//       company.users.push(subUser._id);
//       await company.save({ session });
//     }

//     await session.commitTransaction();

//     res.status(200).json({ message: "Sub-user updated successfully", subUser });
//   } catch (error) {
//     await session.abortTransaction();
//     res
//       .status(500)
//       .json({ message: "Error updating sub-user", error: error.message });
//   } finally {
//     session.endSession();
//   }
// };

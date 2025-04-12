const User = require("../../models/UserModel");
const BusinessProfile = require("../../models/businessProfile");
const Companies = require("../../models/company/companyModel");

exports.updateOrCreateBusinessProfile = async (req, res) => {
  try {
    const data = req.body;
    const files = req.files;

    // Attach uploaded file paths to data
    if (req.files) {
      if (Array.isArray(req.files["logo"]) && req.files["logo"][0]?.filename) {
        data.logo = req.files["logo"] ? req.files["logo"][0].filename : "";
      }

      if (
        Array.isArray(req.files["signature"]) &&
        req.files["signature"][0]?.filename
      ) {
        data.signature = req.files["signature"]
          ? req.files["signature"][0].filename
          : "";
      }
    }

    let businessProfile = await BusinessProfile.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    });

  
    if (data.country === "" || !data.country) data.country = null;



    if (businessProfile) {
      businessProfile = await BusinessProfile.findOneAndUpdate(
        { createdBy: req.user, "companyDetails.companyId": req.companyId },
        { $set: data },
        { new: true }
      );

      await User.findByIdAndUpdate(req.user, {
        $set: {
          email: data.email,
        },
      });

      await Companies.findOneAndUpdate(
        { createdBy: req.user, _id: req.companyId },
        {
          $set: {
            email: data.email,
            companyName: data.businessName,
          },
        }
      );

      return res.status(200).json({
        message: "Business profile updated successfully!",
        businessProfile,
      });
    } else {
      if (req.files) {
        if (
          Array.isArray(req.files["logo"]) &&
          req.files["logo"][0]?.filename
        ) {
          data.logo = req.files["logo"] ? req.files["logo"][0].filename : "";
        }

        if (
          Array.isArray(req.files["signature"]) &&
          req.files["signature"][0]?.filename
        ) {
          data.signature = req.files["signature"]
            ? req.files["signature"][0].filename
            : "";
        }
      }


  
      if (data.country === "" || !data.country) data.country = null;

  
      const newBusinessProfile = new BusinessProfile({
        createdBy: req.user,
        "companyDetails.companyId": req.companyId,
        ...data,
      });

      await newBusinessProfile.save();

      await User.findByIdAndUpdate(req.user, {
        $set: {
          email: data?.email,
          businessProfileId: newBusinessProfile._id,
        },
      });

      return res.status(201).json({
        message: "Business profile created successfully!",
        businessProfile: newBusinessProfile,
      });
    }
  } catch (error) {
    console.error("Error updating/creating business profile:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
};

exports.getBusinessProfile = async (req, res) => {
  try {
    const businessProfile = await BusinessProfile.findOne({
      createdBy: req.user,
      "companyDetails.companyId": req.companyId,
    })
      .populate("state", "name")
      .populate("country", "name");

    if (!businessProfile) {
      return res.status(404).json({
        message: "Business profile not found!",
      });
    }

    res.status(200).json({
      message: "Business profile fetched successfully!",
      businessProfile,
      userRole: req.userRole,
    });
  } catch (error) {
    console.error("Error fetching business profile:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
};

exports.updateBusinessLogo = async (req, res) => {
  try {
    let files = req.files;
    let newLogo = "";
    console.log(files, "Request Filer");
    if (files) {
      newLogo = req.files["logo"] ? req.files["logo"][0].filename : "";
    }

    await BusinessProfile.findOneAndUpdate(
      { createdBy: req.user, "companyDetails.companyId": req.companyId },
      {
        logo: newLogo,
      }
    );

    res.status(201).json({
      status: "Success",
      message: "Logo Updates Successfully",
      updateLogo: newLogo,
    });
  } catch (error) {
    console.error("Error Updating Business Profile Logo:", error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
};

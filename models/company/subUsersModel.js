const mongoose = require("mongoose");

const subUserSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Companies",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users", // Links to the User collection if the sub-user is an existing user
    },
    phoneNo: {
      type: String,
      required: true,
      trim: true,
    },
    userName: {
      type: String,
      trim: true,
    },
    // : {
    //     type: String,
    //     default: "",
    // },
    userRole: {
      type: String,
      default: "Salesman",
    },
    prefix: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "Accepted", "Rejected"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Users", // Refers to the main user who created this sub-user
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("subUsers", subUserSchema);

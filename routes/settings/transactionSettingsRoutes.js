const {
  handleTransactionSettings,
  getTransactionSettings,
} = require("../../controllers/settings/transactionSettings.Controller");

const express = require("express");

const router = express.Router();

const { verifyToken } = require("../../global/jwt");

router.put("/", verifyToken, handleTransactionSettings);
router.get("/", verifyToken, getTransactionSettings);

module.exports = router;

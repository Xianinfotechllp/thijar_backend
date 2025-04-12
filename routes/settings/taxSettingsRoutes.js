const {
  handleTaxSettings,
  getTaxSettings,
} = require("../../controllers/settings/taxSettings.Controller");

const express = require("express");

const router = express.Router();

const { verifyToken } = require("../../global/jwt");

router.put("/", verifyToken, handleTaxSettings);
router.get("/", verifyToken, getTaxSettings);

module.exports = router;

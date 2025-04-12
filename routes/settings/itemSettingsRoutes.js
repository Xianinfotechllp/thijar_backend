const {
  handleItemSettings,
  getItemSettings,
} = require("../../controllers/settings/itemSettings.Controller");

const express = require("express");

const router = express.Router();

const { verifyToken } = require("../../global/jwt");

router.put("/", verifyToken, handleItemSettings);
router.get("/", verifyToken, getItemSettings);

module.exports = router;

const {
    handleGeneralSettings,
    getGeneralSettings,
  } = require("../../controllers/settings/generalSettings.Controller");
  
  const express = require("express");
  
  const router = express.Router();
  
  const { verifyToken } = require("../../global/jwt");
  
  router.put("/", verifyToken, handleGeneralSettings);
  router.get("/", verifyToken, getGeneralSettings);
  
  module.exports = router;
  
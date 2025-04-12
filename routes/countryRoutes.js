const express = require("express");
const {
  getAllCountries,
} = require("../controllers/countries/countryController");
const router = express.Router();

router.get("/", getAllCountries);

module.exports = router;

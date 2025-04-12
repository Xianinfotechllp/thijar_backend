const { addNewCompany, getMyCompanies, setCompanyId } = require("../../controllers/companies/companyController");
const express = require('express');
const router = express.Router();

const { verifyToken } = require("../../global/jwt")
const { uploadFields } = require("../../middleware/multer")

router.post('/', verifyToken, addNewCompany);
router.get('/', verifyToken, getMyCompanies);
router.post('/select-company', verifyToken, setCompanyId);

module.exports = router;



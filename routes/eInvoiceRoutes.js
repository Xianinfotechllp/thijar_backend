const express = require('express');
const router = express.Router();
const { generateEInvoice, } = require('../controllers/e-invoice/e-invoice.controller');
const { verifyToken } = require('../global/jwt');

// router.get('/csr', verifyToken, generateCSRkey);
// router.get('/compliance', verifyToken, generateComplianceCSID);

router.post('/reporting', verifyToken, generateEInvoice);


module.exports = router;
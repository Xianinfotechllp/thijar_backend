const { getProductsForPos, getPOSInvoiceNo, createInvoice, getAllPOSInvoices, getPOSInvoiceById } = require('../../controllers/pos/posController');

const express = require('express');

const router = express.Router();
const { verifyToken, validateUserPrefix } = require("../../global/jwt");

router.get('/invoiceNo', verifyToken, getPOSInvoiceNo);
router.get('/items', verifyToken, getProductsForPos);
router.post('/', verifyToken, createInvoice);
router.get("/", verifyToken, getAllPOSInvoices);
router.get("/:id", verifyToken, getPOSInvoiceById);

module.exports = router;

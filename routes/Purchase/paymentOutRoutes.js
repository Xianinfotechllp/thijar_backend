const { savePaymentOut, getReceiptNo, getPaymentById, getAllPayments, updatePaymentOut, deletePaymentOut } = require("../../controllers/purchase/paymentOutController");
const express = require('express');

const router = express.Router();

const { verifyToken, validateUserPrefix } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

router.get('/', verifyToken, getAllPayments);
router.get('/receiptNo', verifyToken, validateUserPrefix, getReceiptNo);
router.get('/:id', verifyToken, getPaymentById);
router.post('/', verifyToken, validateUserPrefix, uploadArray, savePaymentOut);
router.put('/:id', verifyToken, uploadArray, updatePaymentOut);
router.delete('/:id', verifyToken, deletePaymentOut);



module.exports = router;
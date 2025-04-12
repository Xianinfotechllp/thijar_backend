const { addBankTransfer, getBankTransferById, getAllBankTransfers } = require('../../controllers/bank/bankTransfers/bankTransfer.controller');
const express = require('express');

const router = express.Router();
const { verifyToken } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

router.post('/', verifyToken, uploadArray, addBankTransfer);
router.get('/all', verifyToken, getAllBankTransfers);
router.get('/:transferId', verifyToken, getBankTransferById);



module.exports = router;

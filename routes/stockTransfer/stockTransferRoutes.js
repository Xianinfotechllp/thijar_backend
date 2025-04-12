const { getAllStockTransfers, getStockTransferById, getStockDataForGodown, transferStock } = require('../../controllers/stock/stockTransferController');
const express = require('express');

const router = express.Router();
const { verifyToken } = require("../../global/jwt");


router.get('/', verifyToken, getAllStockTransfers);
router.get('/:id', verifyToken, getStockTransferById);
router.get('/stock-details/:godownId', verifyToken, getStockDataForGodown);
router.post('/', verifyToken, transferStock);
// router.get('/godown-Types', getGodownTypeList);
// router.get('/:id', verifyToken, getGodownDetailsById);
// router.put('/:id', verifyToken, editGodown);
// router.delete('/:id', verifyToken, deleteGodown);


module.exports = router;



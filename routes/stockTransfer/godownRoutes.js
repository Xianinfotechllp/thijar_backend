const { getStockTransfersForGodown, getGodownTypeList, getAllGodowns, addGodown, editGodown, getGodownDetailsById, deleteGodown } = require('../../controllers/stock/godownController');
const express = require('express');

const router = express.Router();
const { verifyToken } = require("../../global/jwt");

router.get('/', verifyToken, getAllGodowns);
router.get('/godown-Types', getGodownTypeList);
// router.get('/:id', verifyToken, getGodownDetailsById);
router.get('/:id', verifyToken, getStockTransfersForGodown);
router.post('/', verifyToken, addGodown);
router.put('/:id', verifyToken, editGodown);
router.delete('/:id', verifyToken, deleteGodown);

module.exports = router;



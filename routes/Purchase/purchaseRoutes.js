const Router = require('express').Router();
const { getBillNumber, getAllPurchaseBills, getPurchaseBillById, createPurchaseBill, updatePurchaseBill, deletePurchaseBill } = require('../../controllers/purchase/purchaseController');
const { verifyToken, validateUserPrefix } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

Router.get('/billNumber', verifyToken, validateUserPrefix, getBillNumber);
Router.get('/', verifyToken, getAllPurchaseBills);
Router.get('/:billId', verifyToken, getPurchaseBillById);
Router.post('/', verifyToken, validateUserPrefix, uploadArray, createPurchaseBill);

Router.put('/:billId', verifyToken, uploadArray, updatePurchaseBill);
Router.delete('/:billId', verifyToken, deletePurchaseBill);

module.exports = Router;    
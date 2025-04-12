const Router = require('express').Router();
const { getPoNumber, getAllPurchaseOrders, getPurchaseOrderById, createOrder, updateOrder, deleteOrder } = require('../../controllers/purchase/poController');
const { verifyToken, validateUserPrefix } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

Router.get('/poNumber', verifyToken, validateUserPrefix, getPoNumber);
Router.get('/', verifyToken, getAllPurchaseOrders);
Router.get('/:orderId', verifyToken, getPurchaseOrderById);
Router.post('/', verifyToken, validateUserPrefix, uploadArray, createOrder);
Router.put('/:orderId', verifyToken, uploadArray, updateOrder);
Router.delete('/:orderId', verifyToken, deleteOrder);

module.exports = Router;
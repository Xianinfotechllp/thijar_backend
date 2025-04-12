const Router = require('express').Router();
const { getOrderNo, getAllOrders, getOrderById, createOrder, updateOrder, deleteOrder } = require('../../controllers/sales/saleOrderController');
const { verifyToken, validateUserPrefix } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

Router.get('/orderNo', verifyToken, validateUserPrefix, getOrderNo);
Router.get('/', verifyToken, getAllOrders);
Router.get('/:id', verifyToken, getOrderById);
Router.post('/', verifyToken, validateUserPrefix, uploadArray, createOrder);
Router.put('/:id', verifyToken, uploadArray, updateOrder);
Router.delete('/:id', verifyToken, deleteOrder);

module.exports = Router;
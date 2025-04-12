const Router = require('express').Router();
const { getTransactionReport } = require('../../controllers/reports/purchase/purchaseReport');
// const { fetchPurchaseWithTaxReport } = require('../../controllers/reports/purchase/purchaseWithTaxReport');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getTransactionReport);
// Router.get('/tax', verifyToken, fetchPurchaseWithTaxReport);

module.exports = Router;
const Route = require('express').Router();
const { fetchSalesWithTaxReport } = require("../../controllers/reports/sales/salesWithTaxReport")
const { fetchSalesReturnWithTaxReport } = require("../../controllers/reports/sales/salesReturnWithTaxReport")
const { fetchPurchaseReturnWithTaxReport } = require("../../controllers/reports/sales/purchaseReturnWithTaxReport")
const { fetchPurchaseWithTaxReport } = require("../../controllers/reports/purchase/purchaseWithTaxReport")
const { verifyToken } = require("../../global/jwt");

Route.get('/sale', verifyToken, fetchSalesWithTaxReport);

Route.get('/sale-return', verifyToken, fetchSalesReturnWithTaxReport);

Route.get('/purchase', verifyToken, fetchPurchaseWithTaxReport);

Route.get('/purchase-return', verifyToken, fetchPurchaseReturnWithTaxReport);


module.exports = Route;
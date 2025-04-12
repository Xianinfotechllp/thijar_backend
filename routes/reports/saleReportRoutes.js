const Router = require('express').Router();
const { getSaleReport } = require('../../controllers/reports/sales/saleReports');
// const { fetchSalesWithTaxReport } = require('../../controllers/reports/sales/salesWithTaxReport');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, getSaleReport);
// Router.get('/tax', verifyToken, fetchSalesWithTaxReport);

module.exports = Router;
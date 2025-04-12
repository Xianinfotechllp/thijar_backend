const Router = require('express').Router();
const { getPartyByItemReport } = require('../../controllers/reports/party/partyReportByitem');
const { generatePartyStatementReport,generatePartyStatementReportDesktop } = require('../../controllers/reports/party/partyStatement');
const { getAllPartiesReport } = require('../../controllers/reports/party/allParties');
const { verifyToken } = require("../../global/jwt");

Router.get('/item', verifyToken, getPartyByItemReport);
Router.get('/all-parties', verifyToken, getAllPartiesReport);
Router.get('/party-statement', verifyToken, generatePartyStatementReport);
Router.get('/party-statement/desktop', verifyToken, generatePartyStatementReportDesktop);

module.exports = Router;
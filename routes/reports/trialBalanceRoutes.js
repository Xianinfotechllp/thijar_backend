const Router = require('express').Router();
const { generateTrialBalanceReport } = require('../../controllers/reports/trialBalance');
const { verifyToken } = require("../../global/jwt");

Router.get('/', verifyToken, generateTrialBalanceReport);

module.exports = Router;
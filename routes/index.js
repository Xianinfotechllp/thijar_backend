// routes/index.js
const express = require("express");
const router = express.Router();

const transactionRoutes = require("./transactionRoutes");

//User Authentication
const authRoutes = require("./auth/authRoute");
const businessProfileRoutes = require("./businessProfileRoute");
const dashboardRoutes = require("./dashboard/dashboardRoutes");

const partyRoutes = require("./partyRoutes");
const unitRoutes = require("./unit/unitRoutes");

//Unit Conversion
const unitConversionRoutes = require("./unit/unitConversion");
const categoryRoutes = require("./categoryRoutes");
const productRoutes = require("./stock/productRoutes");
const adjustItemRoutes = require("./stock/adjustItemRoutes");

//Sales
const quotationRoutes = require("./Sales/quotationRoutes");
const challanRoutes = require("./Sales/challanRoutes");
const paymentInRoutes = require("./Sales/paymentInRoutes");
const invoiceRoutes = require("./Sales/invoiceRoutes");
const saleOrderRoutes = require("./Sales/saleOrderRoutes");
const creditNotesRoutes = require("./Sales/creditNoteRoutes");

//Purchase
const purchaseBillRoutes = require("./Purchase/purchaseRoutes");
const purchaseOrderRoutes = require("./Purchase/poRoutes");
const paymentOutRoutes = require("./Purchase/paymentOutRoutes");
const expenseItemRoutes = require("./Purchase/expenseItemRoutes");
const expenseCategoryRoutes = require("./Purchase/expenseCategoryRoutes");
const expenseRoutes = require("./Purchase/expenseRoutes");
const debitNoteRoutes = require("./Purchase/debitNoteRoutes");



//
const posRoutes = require("./pos/pos.routes")
//
const stateRoutes = require("./stateRoutes");
const countryRoutes = require("./countryRoutes");
const taxRoutes = require("./taxRoutes");

//bank
const bankRoutes = require("./bank/bankRoutes");
const bankAccountRoutes = require("./bank/bankAccountRoutes");
const bankTransferRoutes = require("./bank/bankTransferRoutes");

//Cash
const cashAdjustmentRoutes = require("./cashAdjustmentRoutes");

//Cheque
const chequeRoutes = require("./cheques/chequeRoutes");

//Prefix
const prefixRoutes = require("./prefixRoutes");

//Reports
const transactionReport = require("./reports/transactionRoutes");
const profitAndLossReport = require("./reports/profitLossRoutes");
const partyReportRoutes = require("./reports/partyReportRoutes");
const stockReportRoutes = require("./reports/stockReportRoutes");
const discountReportRoutes = require("./reports/discountReports");
const orderReportRoutes = require("./reports/orderReportRoutes");
const cashFlowReportRoutes = require("./reports/cashFlowReports");
const dayBookReportRoutes = require("./reports/dayBookRoute");
const expenseReportRoutes = require("./reports/expenseReportRoutes");
const bankStatementReport = require("./reports/bankStatementRoutes");
const purchaseReportRoutes = require("./reports/purchaseReportRoutes");
const saleReportRoutes = require("./reports/saleReportRoutes");
const taxReportRoutes = require("./reports/taxRoutes");
const trialBalanceReportRoutes = require("./reports/trialBalanceRoutes");

//Settings
const ItemSettingsRoutes = require("./settings/itemSettingsRoutes");
const taxSettingsRoutes = require("./settings/taxSettingsRoutes");
const transactionSettingsRoutes = require("./settings/transactionSettingsRoutes");
const generalSettingsRoutes = require("./settings/generalSettingsRoutes");

//pdf
const pdfRoutes = require("./pdfRoutes");


const eInvoiceRoutes = require("./eInvoiceRoutes");

//Anomalies
const anomaliesRoutes = require("./anomalies/anomalies.Routes");
const duplicateDetectionRoutes = require("./duplicateDetectionRoutes");
const businessProfileDropdowns = require("./dropdown/businessProfile.Routes");

//Company Routes
const companyRoutes = require("./company/companyRoutes");

//Sync and Share
const subUserRoutes = require("./subUsers/subUserRoutes");

//Stock Transfer  Routes
const godownRoutes = require("./stockTransfer/godownRoutes");
const stockTransferRoutes = require("./stockTransfer/stockTransferRoutes");


//Backup & Restore

const backupRoutes = require("./backup_restore/backup_restore.Routes");

router.use("/auth", authRoutes);

router.use("/businessProfile", businessProfileRoutes);
router.use("/businessProfile/dropdowns", businessProfileDropdowns);

router.use("/transactions", transactionRoutes);

router.use("/parties", partyRoutes);
router.use("/units", unitRoutes);
router.use("/units/conversion", unitConversionRoutes);
router.use("/category", categoryRoutes);
router.use("/products", productRoutes);
router.use("/adjust-item", adjustItemRoutes);

//Sales Module
router.use("/quotation", quotationRoutes);
router.use("/challan", challanRoutes);
router.use("/paymentIn", paymentInRoutes);
router.use("/invoice", invoiceRoutes);
router.use("/order", saleOrderRoutes);
router.use("/credit-note", creditNotesRoutes);

//Purchase Module
router.use("/purchase", purchaseBillRoutes);
router.use("/purchase-orders", purchaseOrderRoutes);
router.use("/paymentOut", paymentOutRoutes);
router.use("/expense-items", expenseItemRoutes);
router.use("/expense-category", expenseCategoryRoutes);
router.use("/expense", expenseRoutes);
router.use("/debit-note", debitNoteRoutes);

router.use("/states", stateRoutes);
router.use("/countries", countryRoutes);
router.use("/taxes", taxRoutes);
router.use("/pos", posRoutes);

router.use("/bank", bankRoutes);
router.use("/bank-Accounts", bankAccountRoutes);
router.use("/bank-accounts/transfer", bankTransferRoutes);
router.use("/cheque", chequeRoutes);
router.use("/adjust-cash", cashAdjustmentRoutes);
router.use("/dashboard", dashboardRoutes);

//Reports
router.use("/reports/transaction", transactionReport);
router.use("/reports/trial-balance", trialBalanceReportRoutes);
router.use("/reports/profitLoss", profitAndLossReport);
router.use("/reports/party", partyReportRoutes);
router.use("/reports/stock", stockReportRoutes);
router.use("/reports/discountPercent", discountReportRoutes);
router.use("/reports/orders", orderReportRoutes);
router.use("/reports/cash-flow", cashFlowReportRoutes);
router.use("/reports/day-book", dayBookReportRoutes);
router.use("/reports/expense", expenseReportRoutes);
router.use("/reports/bank-statement", bankStatementReport);
router.use("/reports/purchase", purchaseReportRoutes);
router.use("/reports/sale", saleReportRoutes);
router.use("/reports/tax", taxReportRoutes);

//Prefix
router.use("/prefix", prefixRoutes);

//Company
router.use("/company", companyRoutes);

//Sync and Share
router.use("/sync-share", subUserRoutes);

//Godown Routes
router.use("/godown", godownRoutes);
router.use("/stock-transfer", stockTransferRoutes);

//Generate Pdf
router.use("/generate-document", pdfRoutes);

//Settings APis
router.use("/settings/item", ItemSettingsRoutes);
router.use("/settings/tax", taxSettingsRoutes);
router.use("/settings/transaction", transactionSettingsRoutes);
router.use("/settings/general", generalSettingsRoutes);

router.use("/anomalies", anomaliesRoutes);
router.use("/duplicate-detection", duplicateDetectionRoutes);

//Backup Apiss
router.use("/backup-restore", backupRoutes);
router.use("/e-invoice", eInvoiceRoutes);


module.exports = router;

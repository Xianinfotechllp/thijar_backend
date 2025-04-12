const Router = require('express').Router();
const { saveInvoice, updateInvoice, getInvoiceNumber, getAllInvoices, getInvoiceById, deleteInvoice, sendInvoice } = require('../../controllers/sales/invoiceController');
const { verifyToken, validateUserPrefix } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

// Router.get('/invoiceNumber',invoiceController.getInvoiceNumber);
// Router.get('/:invoiceNumber',invoiceController.sendInvoicePdf);
Router.get('/invoiceNo', verifyToken, validateUserPrefix, getInvoiceNumber);
Router.get('/', verifyToken, getAllInvoices);
Router.get('/:invoiceId', verifyToken, getInvoiceById);
Router.post('/', verifyToken, validateUserPrefix, uploadArray, saveInvoice);
Router.put('/:invoiceId', verifyToken, uploadArray, updateInvoice);
Router.delete('/:invoiceId', verifyToken, deleteInvoice);

module.exports = Router;
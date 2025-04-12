const Router = require('express').Router();
const { getSaleReturnNumber, getCreditNoteById, getAllCreditNotes, saveCreditNote, editCreditNote, deleteCreditNote } = require('../../controllers/sales/creditNoteController');
const { verifyToken, validateUserPrefix } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

Router.get('/returnNo', verifyToken, validateUserPrefix, getSaleReturnNumber);
Router.get('/', verifyToken, getAllCreditNotes);
Router.get('/:creditNoteId', verifyToken, getCreditNoteById);
Router.post('/', verifyToken, uploadArray, validateUserPrefix, saveCreditNote);
Router.put('/:creditNoteId', verifyToken, uploadArray, editCreditNote);
Router.delete('/:creditNoteId', verifyToken, deleteCreditNote);

module.exports = Router;
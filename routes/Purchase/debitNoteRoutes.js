const Router = require('express').Router();
const { getPurchaseReturnNumber, getDebitNoteById, getAllDebitNotes, saveDebitNote, editDebitNote, deleteDebitNote,getDebitNoteByNumber } = require('../../controllers/purchase/debitNoteController');
const { verifyToken, validateUserPrefix } = require("../../global/jwt");
const { uploadArray } = require("../../middleware/multer");

Router.get('/returnNo', verifyToken, validateUserPrefix, getPurchaseReturnNumber);
Router.get('/', verifyToken, getAllDebitNotes);
Router.get('/:debitNoteId', verifyToken, getDebitNoteById);
Router.get('/returnNo/:returnNo', verifyToken, getDebitNoteByNumber);
Router.post('/', verifyToken, validateUserPrefix, uploadArray, saveDebitNote);
Router.put('/:debitNoteId', verifyToken, uploadArray, editDebitNote);
Router.delete('/:debitNoteId', verifyToken, deleteDebitNote);

module.exports = Router;    
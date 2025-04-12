const { getChallanNo, createChallan, updateChallan, deleteChallan, getAllChallans, getChallanById } = require('../../controllers/sales/challanController');
const express = require('express');

const router = express.Router();
const { verifyToken, validateUserPrefix } = require('../../global/jwt');
const { uploadArray } = require("../../middleware/multer");

router.get('/challanNo', verifyToken, validateUserPrefix, getChallanNo);
router.get('/', verifyToken, getAllChallans);
router.post('/', verifyToken, uploadArray, validateUserPrefix, createChallan);
router.get('/:id', verifyToken, getChallanById);
router.put('/:id', verifyToken, uploadArray, updateChallan);
router.delete('/:id', verifyToken, deleteChallan);

module.exports = router;



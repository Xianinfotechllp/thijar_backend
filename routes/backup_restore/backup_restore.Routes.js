const { generateBackup, restoreBackup } = require('../../controllers/backup/backup');

const express = require('express');

const router = express.Router();
const { verifyToken } = require("../../global/jwt");


const multer = require('multer');
// const upload = multer();
const upload = multer({ dest: "/tmp/" });


router.get('/download', verifyToken, generateBackup);
router.post('/restore', upload.single('file'), verifyToken, restoreBackup);


module.exports = router;
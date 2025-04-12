const express = require('express');
const router = express.Router();
const {addPrefixForUser } = require('../controllers/prefix/prefixController');

const { verifyToken } = require('../global/jwt');

router.post('/',verifyToken, addPrefixForUser);

module.exports = router;
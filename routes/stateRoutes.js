const express = require('express');
const router = express.Router();
const { getAllStates } = require('../controllers/state/stateController');

router.get('/', getAllStates);

// router.get('/test', (req, res) => { return res.status(200).json({ message: "Testing", data: { "t1": "Data" } }) });


module.exports = router;
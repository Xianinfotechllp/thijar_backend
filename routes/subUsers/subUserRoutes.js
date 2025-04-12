const {
  addSubUser,
  getAllSubUsers,
  getPendingRequests,
  approveRequest,
  switchToCompany,
  updateSubUser,
} = require("../../controllers/companies/subUserController");
const express = require("express");

const router = express.Router();
const { verifyToken } = require("../../global/jwt");

router.get("/shared-with-me", verifyToken, getPendingRequests);
// router.get('/:id', verifyToken, getStockTransferById);
// router.get('/stock-details/:godownId', verifyToken, getStockDataForGodown);
router.post("/add-user", verifyToken, addSubUser);
router.get("/users", verifyToken, getAllSubUsers);
// router.post("/update-user/:subUserId", verifyToken, updateSubUser);
router.patch("/approve-request", verifyToken, approveRequest);
router.post("/select-company", verifyToken, switchToCompany);

module.exports = router;

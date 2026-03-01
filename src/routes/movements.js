const express = require('express');
const stockMovementController = require("../controllers/stockMoveController");

const {authMiddleware} = require('../middlewares/authMiddleware');

const router = express.Router();

router.get("/", authMiddleware, stockMovementController.getStockMovements);

module.exports = router;
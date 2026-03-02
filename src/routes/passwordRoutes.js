const express = require("express");
const router = express.Router();

const passwordController = require("../controllers/passwordController");

// Páginas

// API
router.post("/forgot-password", passwordController.forgotPassword);
router.post("/reset-password/:token", passwordController.resetPassword);

module.exports = router;
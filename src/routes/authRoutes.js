// src/routes/authRoutes.js
const express = require('express');
const { login, resetPassword, verifyToken } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', login);
router.post('/reset-password', resetPassword);

// Ruta protegida (con autenticación)
router.get('/verify-token', protect, verifyToken);

module.exports = router;
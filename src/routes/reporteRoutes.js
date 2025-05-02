// src/routes/reporteRoutes.js
const express = require('express');
const { getReporteByUniversidad, getReporteTodasUniversidades } = require('../controllers/reporteController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect); // Comentar temporalmente la protección // Proteger todas las rutas

router.get('/universidad/:idUniversidad', getReporteByUniversidad);
router.get('/todas', getReporteTodasUniversidades);

module.exports = router;
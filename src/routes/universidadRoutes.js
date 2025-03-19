// src/routes/universidadRoutes.js
const express = require('express');
const { getAllUniversidades, getUniversidadById } = require('../controllers/universidadController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect); // Proteger todas las rutas

router.get('/', getAllUniversidades);
router.get('/:id', getUniversidadById);

module.exports = router;
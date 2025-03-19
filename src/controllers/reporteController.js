// src/controllers/reporteController.js
const fichaModel = require('../models/fichaModel');
const asyncHandler = require('../utils/asyncHandler');

const getReporteByUniversidad = asyncHandler(async (req, res) => {
  const { idUniversidad } = req.params;
  const { anios, semanas } = req.query;
  
  // Convertir parámetros a números
  const aniosArray = Array.isArray(anios) ? anios.map(Number) : [Number(anios)];
  const semanasNum = Number(semanas);
  
  // Validaciones básicas
  if (!idUniversidad || !anios || !semanas) {
    return res.status(400).json({
      status: 'fail',
      message: 'Parámetros incompletos o inválidos'
    });
  }
  
  const reporteData = await fichaModel.getReporteByUniversidad(
    idUniversidad,
    aniosArray,
    semanasNum
  );
  
  res.status(200).json({
    status: 'success',
    data: reporteData
  });
});

const getReporteTodasUniversidades = asyncHandler(async (req, res) => {
  const { anios, semanas } = req.query;
  
  // Convertir parámetros a números
  const aniosArray = Array.isArray(anios) ? anios.map(Number) : [Number(anios)];
  const semanasNum = Number(semanas);
  
  // Validaciones básicas
  if (!anios || !semanas) {
    return res.status(400).json({
      status: 'fail',
      message: 'Parámetros incompletos o inválidos'
    });
  }
  
  const reporteData = await fichaModel.getReporteTodasUniversidades(
    aniosArray,
    semanasNum
  );
  
  res.status(200).json({
    status: 'success',
    data: reporteData
  });
});

module.exports = {
  getReporteByUniversidad,
  getReporteTodasUniversidades
};
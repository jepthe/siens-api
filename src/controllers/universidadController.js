// src/controllers/universidadController.js
const universidadModel = require('../models/universidadModel');
const asyncHandler = require('../utils/asyncHandler');

const getAllUniversidades = asyncHandler(async (req, res) => {
  const universidades = await universidadModel.findAll();
  
  res.status(200).json({
    status: 'success',
    results: universidades.length,
    data: universidades
  });
});

const getUniversidadById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const universidad = await universidadModel.findById(id);
  
  if (!universidad) {
    return res.status(404).json({
      status: 'fail',
      message: 'Universidad no encontrada'
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: universidad
  });
});

module.exports = {
  getAllUniversidades,
  getUniversidadById
};
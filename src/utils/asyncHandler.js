// src/utils/asyncHandler.js
// Utilidad para manejar funciones asincrónicas en Express
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
  
  module.exports = asyncHandler;
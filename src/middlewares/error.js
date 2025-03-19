// src/middlewares/error.js
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
  
    // Errores propios de la aplicación
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    }
  
    // Errores desconocidos
    return res.status(500).json({
      status: 'error',
      message: 'Algo salió mal'
    });
  };
  
  module.exports = errorHandler;  
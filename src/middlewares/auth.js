// src/middlewares/auth.js
const { verifyToken } = require('../config/jwt');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  // 1) Obtener el token
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      status: 'fail',
      message: 'No estás autenticado. Por favor inicia sesión.'
    });
  }

  // 2) Verificar el token
  try {
    const decoded = verifyToken(token);
    
    // 3) Guardar el usuario en req para uso posterior
    req.user = {
      id: decoded.id,
      roleId: decoded.roleId,
      universidadId: decoded.universidadId
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'fail',
      message: 'Token inválido o expirado'
    });
  }
});

// Middleware para restricción de roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles es un array: ['admin', 'editor']
    if (!roles.includes(req.user.roleId)) {
      return res.status(403).json({
        status: 'fail',
        message: 'No tienes permiso para realizar esta acción'
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
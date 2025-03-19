// src/controllers/authController.js
const userModel = require('../models/userModel');
const { generateToken } = require('../config/jwt');
const asyncHandler = require('../utils/asyncHandler');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Usamos email como username porque así está en nuestro frontend por ahora
  const username = email;

  // 1) Verificar si el usuario existe (usando username en lugar de email)
  const user = await userModel.findByEmail(username);
  if (!user) {
    return res.status(401).json({
      status: 'fail',
      message: 'Nombre de usuario o contraseña incorrectos'
    });
  }

  // 2) Verificar si la contraseña es correcta
  const isPasswordCorrect = await userModel.verifyPassword(password, user.cContraseña);
  if (!isPasswordCorrect) {
    return res.status(401).json({
      status: 'fail',
      message: 'Email o contraseña incorrectos'
    });
  }

  // 3) Generar token JWT
  const token = generateToken({
    id: user.iIdUsuario,
    roleId: user.iIdRol,
    universidadId: user.iIdUniversidad
  });

  // 4) Enviar respuesta con token y datos del usuario
  res.status(200).json({
    status: 'success',
    token,
    user: {
      iIdUsuario: user.iIdUsuario,
      cNombreUsuario: user.cNombreUsuario,
      iIdRol: user.iIdRol,
      nombreRol: user.nombreRol,
      iIdUniversidad: user.iIdUniversidad
    }
  });
});

module.exports = { login };
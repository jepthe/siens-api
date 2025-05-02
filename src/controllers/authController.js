// src/controllers/authController.js
const userModel = require('../models/userModel');
const { generateToken } = require('../config/jwt');
const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Vamos a buscar usuario por email o nombre de usuario
  let user = null;
  
  // Primero buscamos por correo electrónico
  let userByEmail = await userModel.findByEmail(email);
  
  if (!userByEmail) {
    // Si no se encuentra por email, buscamos por nombre de usuario
    user = await userModel.findByUsername(email);
  } else {
    user = userByEmail;
  }

  // 1) Verificar si el usuario existe
  if (!user) {
    return res.status(401).json({
      status: 'fail',
      message: 'Nombre de usuario o contraseña incorrectos'
    });
  }

  // 2) Verificar si la contraseña es correcta
  // Determinar si la contraseña está hasheada o no
  let isPasswordCorrect;
  let isPlainTextPassword = false;
  
  if (user.cContraseña.startsWith('$2')) {
    // La contraseña está hasheada con bcrypt, usar bcrypt.compare
    isPasswordCorrect = await bcrypt.compare(password, user.cContraseña);
  } else {
    // La contraseña está en texto plano, comparar directamente
    isPasswordCorrect = password === user.cContraseña;
    isPlainTextPassword = true;
  }

  if (!isPasswordCorrect) {
    return res.status(401).json({
      status: 'fail',
      message: 'Email o contraseña incorrectos'
    });
  }

  // 3) Si la contraseña está en texto plano, hashearla automáticamente
  if (isPlainTextPassword) {
    try {
      // Actualizamos la contraseña a una versión hasheada
      await userModel.upgradePasswordToHashed(user.iIdUsuario, password);
    } catch (error) {
      console.error('Error al actualizar contraseña a versión hasheada:', error);
    }
  }

  // 4) Generar token JWT
  const token = generateToken({
    id: user.iIdUsuario,
    roleId: user.iIdRol,
    universidadId: user.iIdUniversidad
  });

  // 5) Procesar la URL de la imagen si existe
  let imageUrl = user.cImagen;
  if (imageUrl) {
    const baseUrl = process.env.API_URL || 'https://sies-image-server-production.up.railway.app';
    
    // Formatear correctamente la URL de la imagen
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Forzar HTTPS por seguridad
      imageUrl = imageUrl.replace(/^http:\/\//i, 'https://');
    } 
    else if (imageUrl.startsWith('/img/')) {
      imageUrl = `${baseUrl}${imageUrl}`;
    }
    else {
      imageUrl = `${baseUrl}/img/${imageUrl}`;
    }
  }

  // 6) Enviar respuesta con token y datos del usuario
  res.status(200).json({
    status: 'success',
    token,
    user: {
      iIdUsuario: user.iIdUsuario,
      cNombreUsuario: user.cNombreUsuario,
      iIdRol: user.iIdRol,
      nombreRol: user.nombreRol,
      iIdUniversidad: user.iIdUniversidad,
      cImagen: imageUrl
    }
  });
});

// Resto del controlador permanece igual
const generateRandomPassword = async () => {
  // Genera una contraseña de 10 caracteres: letras mayúsculas, minúsculas y números
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % charset.length;
    password += charset[randomIndex];
  }
  
  return password;
};

// Configuración del transporte de correo
const createTransporter = () => {
  // Crear un objeto de transporte reutilizable usando SMTP
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para otros puertos
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const resetPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      status: 'fail',
      message: 'Por favor proporciona tu correo electrónico'
    });
  }

  // 1) Buscar al usuario por correo electrónico
  const user = await userModel.findUserByEmail(email);
  
  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'No existe ningún usuario con ese correo electrónico'
    });
  }

  // 2) Generar una nueva contraseña aleatoria
  const newPassword = await generateRandomPassword();
  
  // 3) Actualizar la contraseña en la base de datos 
  await userModel.updatePassword(user.iIdUsuario, newPassword);

  // 4) Enviar la nueva contraseña por correo electrónico
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Sistema SIENS" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Tu nueva contraseña - SIENS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #003882;">Recuperación de contraseña</h2>
          <p>Hola ${user.cNombreUsuario},</p>
          <p>Has solicitado restablecer tu contraseña en el sistema SIENS.</p>
          <p>Tu nueva contraseña es: <strong>${newPassword}</strong></p>
          <p>Por motivos de seguridad, te recomendamos cambiar esta contraseña (hacerlo en la página web) después de iniciar sesión.</p>
          <p>Si no solicitaste este cambio, por favor contacta al administrador del sistema inmediatamente.</p>
          <p style="margin-top: 30px;">Saludos,<br>Equipo SIENS</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (emailError) {
    console.error('Error al enviar correo:', emailError);
    // Continuar con la respuesta incluso si falla el envío de correo
  }

  // 5) Responder al cliente
  res.status(200).json({
    status: 'success',
    message: 'Se ha enviado una nueva contraseña a tu correo electrónico'
  });
});

const verifyToken = asyncHandler(async (req, res) => {
  // El usuario ya está disponible en req.user gracias al middleware protect
  const userId = req.user.id;
  
  // Buscar los datos completos del usuario
  const user = await userModel.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'Usuario no encontrado'
    });
  }
  
  // Enviar datos del usuario
  res.status(200).json({
    status: 'success',
    user: {
      iIdUsuario: user.iIdUsuario,
      cNombreUsuario: user.cNombreUsuario,
      iIdRol: user.iIdRol,
      nombreRol: user.nombreRol,
      iIdUniversidad: user.iIdUniversidad,
      cImagen: user.cImagen
    }
  });
});

module.exports = { 
  login,
  resetPassword,
  verifyToken  // Exportar la nueva función
};
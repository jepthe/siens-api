// src/app.js
const express = require('express');
const cors = require('cors');
const db = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
  res.json({ message: 'API de SIENS funcionando correctamente' });
});

// Ruta de prueba para la BD
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tcAnio LIMIT 5');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error en test de BD:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para universidades
app.get('/api/universidades', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tcUniversidad WHERE bActivo = 1');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener universidades:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para obtener datos de reporte por universidad
app.get('/api/reportes/universidad/:idUniversidad', async (req, res) => {
  try {
    const { idUniversidad } = req.params;
    const anios = req.query.anios ? (Array.isArray(req.query.anios) ? req.query.anios : [req.query.anios]) : [];
    const semanas = req.query.semanas || 10;
    
    console.log(`Obteniendo reporte para universidad ${idUniversidad}, años:`, anios, 'semanas:', semanas);
    
    // Consulta para las fichas de esta universidad
    const [fichas] = await db.query(
      `SELECT 
        f.iIdFicha, f.iIdUniversidad, f.iIdCarrera, f.iIdBachillerato,
        f.iIdAnio, a.cAnio as anio, 
        f.iIdSemana, s.iNumeroSemana as semana,
        f.iHombre, f.iMujer, f.iCantidad 
      FROM 
        tdFicha f
        JOIN tcAnio a ON f.iIdAnio = a.iIdAnio
        JOIN tcSemana s ON f.iIdSemana = s.iIdSemana
      WHERE 
        f.iIdUniversidad = ?
        AND s.iNumeroSemana <= ?
      ORDER BY 
        a.cAnio, s.iNumeroSemana`,
      [idUniversidad, semanas]
    );
    
    // Procesar datos para formato esperado por el frontend
    const reporteData = {
      regular: [],
      acumulado: []
    };
    
    // Mapa para rastrear acumulados por año
    const acumuladosPorAnio = {};
    
    // Procesar filas de resultados
    fichas.forEach(ficha => {
      const anioNum = parseInt(ficha.anio);
      
      // Datos regulares
      reporteData.regular.push({
        semana: ficha.semana,
        anio: anioNum,
        cantidad: ficha.iCantidad
      });
      
      // Inicializar acumulado para este año si no existe
      if (!acumuladosPorAnio[anioNum]) {
        acumuladosPorAnio[anioNum] = 0;
      }
      
      // Calcular acumulado
      acumuladosPorAnio[anioNum] += ficha.iCantidad;
      
      // Datos acumulados
      reporteData.acumulado.push({
        semana: ficha.semana,
        anio: anioNum,
        cantidad: ficha.iCantidad,
        acumulado: acumuladosPorAnio[anioNum]
      });
    });
    
    res.json(reporteData);
  } catch (error) {
    console.error(`Error al obtener reporte para universidad ${req.params.idUniversidad}:`, error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Endpoint para login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Intento de login con:', { email });
    
    // Buscar usuario por nombre de usuario
    const [users] = await db.query(
      'SELECT * FROM tcUsuario WHERE cNombreUsuario = ?',
      [email]
    );
    
    // Verificar si existe el usuario
    if (users.length === 0) {
      console.log('Usuario no encontrado');
      return res.status(401).json({ 
        message: 'Credenciales incorrectas' 
      });
    }
    
    const user = users[0];
    
    // Verificar la contraseña (aquí sin encriptación por simplicidad)
    if (user.cContraseña !== password) {
      console.log('Contraseña incorrecta');
      return res.status(401).json({ 
        message: 'Credenciales incorrectas' 
      });
    }
    
    // Obtener el rol del usuario
    const [roles] = await db.query(
      'SELECT r.cNombreRol FROM tcRol r WHERE r.iIdRol = ?',
      [user.iIdRol]
    );
    
    const roleName = roles.length > 0 ? roles[0].cNombreRol : 'Usuario';
    
    // Login exitoso - enviar información del usuario (sin token por ahora)
    console.log('Login exitoso para usuario:', user.cNombreUsuario);
    
    res.status(200).json({
      user: {
        iIdUsuario: user.iIdUsuario,
        cNombreUsuario: user.cNombreUsuario,
        iIdRol: user.iIdRol,
        nombreRol: roleName,
        iIdUniversidad: user.iIdUniversidad
      }
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor' 
    });
  }
});

// Endpoint para obtener datos de todas las universidades
app.get('/api/reportes/todas', async (req, res) => {
  try {
    const anios = req.query.anios ? (Array.isArray(req.query.anios) ? req.query.anios : [req.query.anios]) : [];
    const semanas = req.query.semanas || 10;
    
    console.log(`Obteniendo reporte para todas las universidades, años:`, anios, 'semanas:', semanas);
    
    // Primero obtenemos todas las universidades activas
    const [universidades] = await db.query('SELECT iIdUniversidad, cNombreCorto FROM tcUniversidad WHERE bActivo = 1');
    
    // Objeto para almacenar resultados por universidad
    const resultados = {};
    
    // Para cada universidad, obtenemos sus datos
    for (const universidad of universidades) {
      const universidadId = universidad.iIdUniversidad;
      const nombreCorto = universidad.cNombreCorto;
      
      // Consulta para las fichas de esta universidad
      const [fichas] = await db.query(
        `SELECT 
          f.iIdFicha, f.iIdUniversidad, f.iIdCarrera, f.iIdBachillerato,
          f.iIdAnio, a.cAnio as anio, 
          f.iIdSemana, s.iNumeroSemana as semana,
          f.iHombre, f.iMujer, f.iCantidad 
        FROM 
          tdFicha f
          JOIN tcAnio a ON f.iIdAnio = a.iIdAnio
          JOIN tcSemana s ON f.iIdSemana = s.iIdSemana
        WHERE 
          f.iIdUniversidad = ?
          AND s.iNumeroSemana <= ?
        ORDER BY 
          a.cAnio, s.iNumeroSemana`,
        [universidadId, semanas]
      );
      
      // Procesar datos para esta universidad
      const universidadData = {
        regular: [],
        acumulado: []
      };
      
      // Mapa para rastrear acumulados por año
      const acumuladosPorAnio = {};
      
      // Procesar filas de resultados
      fichas.forEach(ficha => {
        const anioNum = parseInt(ficha.anio);
        
        // Datos regulares
        universidadData.regular.push({
          semana: ficha.semana,
          anio: anioNum,
          cantidad: ficha.iCantidad
        });
        
        // Inicializar acumulado para este año si no existe
        if (!acumuladosPorAnio[anioNum]) {
          acumuladosPorAnio[anioNum] = 0;
        }
        
        // Calcular acumulado
        acumuladosPorAnio[anioNum] += ficha.iCantidad;
        
        // Datos acumulados
        universidadData.acumulado.push({
          semana: ficha.semana,
          anio: anioNum,
          cantidad: ficha.iCantidad,
          acumulado: acumuladosPorAnio[anioNum]
        });
      });
      
      // Guardar resultados de esta universidad
      resultados[nombreCorto] = universidadData;
    }
    
    res.json(resultados);
  } catch (error) {
    console.error(`Error al obtener reporte para todas las universidades:`, error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});


// Exportar la app
module.exports = app;
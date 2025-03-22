// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

const app = express();

//pdf
// En el backend (app.js)
const PDFDocument = require('pdfkit');
const fs = require('fs');
const fichaModel = require('./models/fichaModel');

// Asegurarse de que el directorio tmp exista
const tmpDir = path.join(__dirname, '../tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

// Configurar ruta para servir archivos PDF temporales
app.use('/tmp', express.static(path.join(__dirname, '../tmp')));

// Endpoint para generar PDF
app.get('/api/reportes/pdf', async (req, res) => {
  const pdfFileName = `reporte_${Date.now()}.pdf`;
  const pdfPath = path.join(tmpDir, pdfFileName);
  
  try {
    const { anios, semanas } = req.query;
    console.log('Generando PDF con parámetros:', { anios, semanas });
    
    // Convertir parámetros a formato adecuado (corrigiendo el error)
    const aniosArray = Array.isArray(anios) ? anios.map(Number) : [Number(anios)];
    const semanasNum = Number(semanas);
    
    // Obtener los datos para el reporte
    let reporteData = {};
    
    try {
      // Obtener datos para el reporte
      reporteData = await fichaModel.getReporteTodasUniversidades(aniosArray, semanasNum);
    } catch (dataError) {
      console.error('Error al obtener datos para el PDF:', dataError);
      // Si hay error, usar datos vacíos
      reporteData = { UTSJR: { regular: [], acumulado: [] } };
    }
    
    // Obtener la lista de universidades
    const UNIVERSITIES = Object.keys(reporteData);
    
    // Crear el documento PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      layout: 'landscape' // Para tablas más anchas
    });
    
    // Crear un stream para guardar el archivo
    const stream = fs.createWriteStream(pdfPath);
    
    // Pipe el documento al stream de archivo
    doc.pipe(stream);
    
    // Título del reporte
    doc.fontSize(24).text('Reporte de Todas las Universidades', {
      align: 'center'
    });
    
    doc.moveDown();
    doc.fontSize(12).text(`Fecha: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.fontSize(12).text(`Años seleccionados: ${aniosArray.join(', ')}`, { align: 'left' });
    doc.fontSize(12).text(`Semanas: 1-${semanasNum}`, { align: 'left' });
    
    doc.moveDown(2);
    
    // Dibujar tabla combinada (similar a AllModulesScreen)
    const tableTop = doc.y;
    const tableWidth = doc.page.width - 100; // Ancho total de la tabla
    
    // Calcular el ancho para cada columna de universidad+año
    const cellsCount = 1 + (UNIVERSITIES.length * aniosArray.length); // 1 para la columna de semana
    const baseColWidth = tableWidth / cellsCount;
    const weekColWidth = baseColWidth;
    const dataColWidth = baseColWidth;
    
    // Función para crear el encabezado de la tabla
    function drawTableHeader() {
      const startY = doc.y;
      
      // Primer nivel de encabezado (universidades)
      let x = 50;
      doc.fillColor('#e6e6e6').rect(x, startY, weekColWidth, 30).fill();
      doc.fillColor('black').fontSize(10).text('Semana', x + 5, startY + 10, { width: weekColWidth - 10, align: 'center' });
      
      x += weekColWidth;
      
      UNIVERSITIES.forEach(uni => {
        const uniColWidth = dataColWidth * aniosArray.length;
        doc.fillColor('#e6e6e6').rect(x, startY, uniColWidth, 30).fill();
        doc.fillColor('black').fontSize(10).text(uni, x + 5, startY + 10, { width: uniColWidth - 10, align: 'center' });
        x += uniColWidth;
      });
      
      // Segundo nivel de encabezado (años)
      x = 50 + weekColWidth; // Comenzamos después de la columna de semana
      const yearHeaderY = startY + 30;
      
      UNIVERSITIES.forEach(uni => {
        aniosArray.forEach(year => {
          doc.fillColor('#f2f2f2').rect(x, yearHeaderY, dataColWidth, 25).fill();
          doc.fillColor('black').fontSize(9).text(year.toString(), x + 5, yearHeaderY + 8, { width: dataColWidth - 10, align: 'center' });
          x += dataColWidth;
        });
      });
      
      return yearHeaderY + 25; // Devolvemos la posición Y después de los encabezados
    }
    
    // Dibujar los encabezados de la tabla
    let currentY = drawTableHeader();
    
    // Preparar los datos para combinar en filas
    // Primero, encontramos todas las semanas únicas
    const allSemanas = new Set();
    Object.values(reporteData).forEach(uniData => {
      if (uniData && uniData.regular) {
        uniData.regular.forEach(item => {
          if (item && item.semana && item.semana <= semanasNum) {
            allSemanas.add(item.semana);
          }
        });
      }
    });
    
    // Convertir a array y ordenar
    const uniqueSemanas = Array.from(allSemanas).sort((a, b) => a - b);
    
    // Dibujar filas de datos
    uniqueSemanas.forEach((semana, index) => {
      const rowY = currentY;
      let x = 50;
      
      // Alternar colores de fondo
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
      doc.fillColor(bgColor).rect(x, rowY, tableWidth, 20).fill();
      
      // Columna de semana
      doc.fillColor('black').fontSize(9).text(`S${semana}`, x + 5, rowY + 5, { width: weekColWidth - 10, align: 'center' });
      x += weekColWidth;
      
      // Datos para cada universidad y año
      UNIVERSITIES.forEach(uni => {
        const uniData = reporteData[uni];
        
        aniosArray.forEach(year => {
          // Buscar datos para esta semana y año
          let value = 0;
          if (uniData && uniData.regular) {
            const data = uniData.regular.find(item => 
              item && item.semana === semana && item.anio === year
            );
            if (data) {
              value = data.cantidad || 0;
            }
          }
          
          doc.fillColor('black').fontSize(9).text(value.toString(), x + 5, rowY + 5, { width: dataColWidth - 10, align: 'center' });
          x += dataColWidth;
        });
      });
      
      currentY += 20;
    });
    
    // Dibujar fila de totales
    const totalsRowY = currentY;
    let x = 50;
    
    // Fondo destacado para totales
    doc.fillColor('#e6f7ff').rect(x, totalsRowY, tableWidth, 25).fill();
    
    // Etiqueta de totales
    doc.fillColor('black').fontSize(10).font('Helvetica-Bold').text('Totales', x + 5, totalsRowY + 7, { width: weekColWidth - 10, align: 'center' });
    x += weekColWidth;
    
    // Totales para cada universidad y año
    UNIVERSITIES.forEach(uni => {
      const uniData = reporteData[uni];
      
      aniosArray.forEach(year => {
        // Buscar el último dato acumulado para este año
        let total = 0;
        if (uniData && uniData.acumulado) {
          const acumulados = uniData.acumulado
            .filter(item => item && item.anio === year && item.semana <= semanasNum)
            .sort((a, b) => b.semana - a.semana);
          
          if (acumulados.length > 0) {
            total = acumulados[0].acumulado || 0;
          }
        }
        
        doc.fillColor('black').fontSize(10).font('Helvetica-Bold').text(total.toString(), x + 5, totalsRowY + 7, { width: dataColWidth - 10, align: 'center' });
        
        // Si hay más de un año, mostrar la diferencia
        if (aniosArray.length > 1 && year === aniosArray[aniosArray.length - 1] && aniosArray.includes(year - 1)) {
          // Calcular diferencia con el año anterior
          let prevTotal = 0;
          if (uniData && uniData.acumulado) {
            const prevAcumulados = uniData.acumulado
              .filter(item => item && item.anio === (year - 1) && item.semana <= semanasNum)
              .sort((a, b) => b.semana - a.semana);
            
            if (prevAcumulados.length > 0) {
              prevTotal = prevAcumulados[0].acumulado || 0;
            }
          }
          
          const diff = total - prevTotal;
          const diffText = `(${diff > 0 ? '+' : ''}${diff})`;
          const diffColor = diff > 0 ? 'green' : 'red';
          
          doc.fillColor(diffColor).fontSize(8).text(diffText, x + 5, totalsRowY + 18, { width: dataColWidth - 10, align: 'center' });
        }
        
        x += dataColWidth;
      });
    });
    
    // Dibujar bordes de la tabla
    doc.rect(50, tableTop, tableWidth, (totalsRowY + 25) - tableTop).stroke();
    
    // Líneas verticales
    x = 50 + weekColWidth;
    doc.moveTo(x, tableTop).lineTo(x, totalsRowY + 25).stroke();
    
    UNIVERSITIES.forEach(uni => {
      x += dataColWidth * aniosArray.length;
      doc.moveTo(x, tableTop).lineTo(x, totalsRowY + 25).stroke();
    });
    
    // Líneas horizontales después de los encabezados
    doc.moveTo(50, tableTop + 30).lineTo(50 + tableWidth, tableTop + 30).stroke();
    doc.moveTo(50, tableTop + 55).lineTo(50 + tableWidth, tableTop + 55).stroke();
    
    // Línea antes de los totales
    doc.moveTo(50, totalsRowY).lineTo(50 + tableWidth, totalsRowY).stroke();
    
    // Líneas para cada fila de datos
    let rowY = tableTop + 55 + 20;
    while (rowY < totalsRowY) {
      doc.moveTo(50, rowY).lineTo(50 + tableWidth, rowY).stroke();
      rowY += 20;
    }
    
    // Líneas verticales para las columnas de año
    x = 50 + weekColWidth;
    UNIVERSITIES.forEach(uni => {
      for (let i = 0; i < aniosArray.length; i++) {
        doc.moveTo(x, tableTop + 30).lineTo(x, totalsRowY + 25).stroke();
        x += dataColWidth;
      }
    });
    
    // Pie de página
    doc.fontSize(8);
    doc.text(
      `Reporte generado el ${new Date().toLocaleDateString()}`,
      50,
      doc.page.height - 30,
      { align: 'center' }
    );
    
    // Finalizar el documento
    doc.end();
    
    // Esperar a que se complete la escritura del documento
    stream.on('finish', () => {
      console.log(`PDF generado correctamente: ${pdfPath}`);
      
      // Construir la URL para acceder al archivo
      const fileUrl = `${req.protocol}://${req.get('host')}/tmp/${pdfFileName}`;
      
      // Devolver la información al cliente
      res.json({
        success: true,
        url: fileUrl,
        fileName: pdfFileName,
        message: 'PDF generado correctamente'
      });
      
      // Programar la eliminación del archivo después de 30 minutos
      setTimeout(() => {
        try {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
          }
        } catch (unlinkError) {
          console.error('Error al eliminar archivo temporal:', unlinkError);
        }
      }, 30 * 60 * 1000); // 30 minutos
    });
    
  } catch (error) {
    console.error('Error general generando PDF:', error);
    
    // Intentar eliminar el archivo si ocurrió un error
    try {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    } catch (unlinkError) {
      console.error('Error al eliminar archivo en manejo de errores:', unlinkError);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error al generar PDF' 
    });
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Configurar servicio de archivos estáticos para imágenes
app.use('/images', express.static(path.join(__dirname, '../public')));

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
    
    // Buscar usuario por correo electrónico usando JOIN con tdDetallesUsuario
    const [users] = await db.query(
      `SELECT u.*, d.cCorreo, d.cNombreCompleto 
       FROM tdUsuario u
       INNER JOIN tdDetallesUsuario d ON u.iIdUsuario = d.iIdUsuario
       WHERE d.cCorreo = ?`,
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
    
    // Login exitoso - enviar información del usuario
    console.log('Login exitoso para usuario:', user.cNombreUsuario);
    
    // Protección contra propiedades posiblemente indefinidas
    const safeResponse = {
      user: {
        iIdUsuario: user.iIdUsuario,
        cNombreUsuario: user.cNombreUsuario || '',
        cNombreCompleto: user.cNombreCompleto || '',
        cCorreo: user.cCorreo || '',
        iIdRol: user.iIdRol || null,
        nombreRol: roleName || 'Usuario',
        iIdUniversidad: user.iIdUniversidad || null
      }
    };
    
    // Si existe cImagen, añadirla al objeto de respuesta con la ruta completa
    if (user.cImagen) {
      // Construir la URL base del servidor
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const imageUrl = `${baseUrl}/images/${user.cImagen}`;
      safeResponse.user.cImagen = `${baseUrl}/images/${user.cImagen}`;
      console.log('URL de imagen generada:', imageUrl);
    }
    
    res.status(200).json(safeResponse);
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

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  res.status(500).json({
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Exportar la app
module.exports = app;
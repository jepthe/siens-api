// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

require('dotenv').config();
const PRODUCTION_URL = process.env.API_URL || 'https://siens-api-production.up.railway.app';//por si no se define la variable de entorno, resuelve imagen perfil

const app = express();

// Importar moment-timezone al inicio del archivo
const moment = require('moment-timezone');

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
// Solución completa para el endpoint de generación de PDF

// En app.js - Modificar la función de generación de PDF
app.get('/api/reportes/pdf', async (req, res) => {
  const pdfFileName = `reporte_${Date.now()}.pdf`;
  const pdfPath = path.join(tmpDir, pdfFileName);
  
  try {
    const { anios, semanas, usuario, timezone } = req.query;
    const nombreUsuario = usuario || 'Usuario'; // Valor por defecto
    
    console.log('=== INICIANDO GENERACIÓN DE PDF ===');
    console.log('Parámetros recibidos:', { anios, semanas, usuario, timezone });
    
    // Convertir parámetros a formato adecuado
    const aniosArray = Array.isArray(anios) ? anios.map(Number) : [Number(anios)];
    const semanasNum = Number(semanas);
    
    // Obtener los datos para el reporte
    let reporteData = {};
    try {
      reporteData = await fichaModel.getReporteTodasUniversidades(aniosArray, semanasNum);
    } catch (dataError) {
      console.error('Error al obtener datos para el PDF:', dataError);
      reporteData = {};
    }
    
    // Obtener la lista de universidades
    const UNIVERSITIES = Object.keys(reporteData);
    
    // Crear el documento PDF
    const doc = new PDFDocument({ 
      margin: 40,
      size: 'A4',
      layout: 'landscape', // Para tablas más anchas
      bufferPages: true 
    });
    
    // Crear un stream para guardar el archivo
    const stream = fs.createWriteStream(pdfPath);
    
    // Pipe el documento al stream de archivo
    doc.pipe(stream);
    
    // Formato de fecha/hora
    let formattedDate, formattedTime;
    try {
      if (timezone) {
        const clientDate = new Date();
        const clientOffset = parseFloat(timezone) || 0;
        const serverOffset = clientDate.getTimezoneOffset() * -1 / 60;
        const offsetDiff = clientOffset - serverOffset;
        
        clientDate.setHours(clientDate.getHours() + offsetDiff);
        
        formattedDate = `${String(clientDate.getDate()).padStart(2, '0')}/${String(clientDate.getMonth() + 1).padStart(2, '0')}/${clientDate.getFullYear()}`;
        formattedTime = `${String(clientDate.getHours()).padStart(2, '0')}:${String(clientDate.getMinutes()).padStart(2, '0')}:${String(clientDate.getSeconds()).padStart(2, '0')}`;
      } else {
        const serverDate = new Date();
        formattedDate = `${String(serverDate.getDate()).padStart(2, '0')}/${String(serverDate.getMonth() + 1).padStart(2, '0')}/${serverDate.getFullYear()}`;
        formattedTime = `${String(serverDate.getHours()).padStart(2, '0')}:${String(serverDate.getMinutes()).padStart(2, '0')}:${String(serverDate.getSeconds()).padStart(2, '0')}`;
      }
    } catch (timeError) {
      const fallbackDate = new Date();
      formattedDate = `${String(fallbackDate.getDate()).padStart(2, '0')}/${String(fallbackDate.getMonth() + 1).padStart(2, '0')}/${fallbackDate.getFullYear()}`;
      formattedTime = `${String(fallbackDate.getHours()).padStart(2, '0')}:${String(fallbackDate.getMinutes()).padStart(2, '0')}:${String(fallbackDate.getSeconds()).padStart(2, '0')}`;
    }

    // Añadir el logo en la esquina superior izquierda (solo primera página)
    try {
      const logoPath = path.join(__dirname, '../frontend/public/img/general/LOGO_pdf.png');
      
      if (fs.existsSync(logoPath)) {
        doc.image(
          logoPath,
          50, // margen izquierdo
          50, // margen superior
          {
            fit: [100, 50],
            align: 'left',
            valign: 'top'
          }
        );
      }
    } catch (logoError) {
      console.error('Error al añadir el logo al PDF:', logoError);
    }

    // Título del reporte
    doc.fontSize(24).text('Concentrado de Universidades', {
      align: 'center'
    });
    
    doc.moveDown();
    
    // Información del documento
    doc.fontSize(10)
      .text(`Fecha: ${formattedDate} | Hora: ${formattedTime}`, { align: 'right' })
      .text(`Generado por: ${nombreUsuario} | Página 1 de 1`, { align: 'right' });
    // Nota: el "1 de 1" se corregirá más adelante en el código
    
    doc.moveDown(2);
    
    // *** MEJORA: Crear tabla optimizada en una sola página ***
    
    // Determinar todas las semanas disponibles hasta el límite seleccionado
    const semanasArray = Array.from({ length: semanasNum }, (_, i) => i + 1);
    
    // Calcular ancho de las columnas
    const pageWidth = doc.page.width - 80; // 40px de margen en cada lado
    const firstColWidth = 80; // Ancho de la primera columna (semanas)
    const totalColWidth = 80; // Ancho de la columna de totales
    const dataColWidth = (pageWidth - firstColWidth - totalColWidth) / (UNIVERSITIES.length * aniosArray.length);
    
    // Posición vertical actual
    let yPos = doc.y;
    
    // Dibujar encabezado de la tabla
    doc.rect(40, yPos, pageWidth, 60).fillAndStroke('#f5f5f5', '#cccccc'); // Fondo gris claro
    
    // Primera fila: Nombre de universidades
    let xPos = 40 + firstColWidth;
    doc.fontSize(10).fillColor('#000000');
    doc.text('Semana', 50, yPos + 15, { width: firstColWidth - 20, align: 'center' });
    
    // Mapeo de nombres de univerisdades a sus logos
    const universityImages = {
      'UPQ': path.join(__dirname, '../frontend/public/img/universidades/LOGO_UPQ.png'),
      'UPSRJ': path.join(__dirname, '../frontend/public/img/universidades/LOGO_UPSRJ.png'),
      'UTEQ': path.join(__dirname, '../frontend/public/img/universidades/LOGO_UTEQ.png'),
      'UTC': path.join(__dirname, '../frontend/public/img/universidades/LOGO_UTC.png'),
      'UTSJR': path.join(__dirname, '../frontend/public/img/universidades/LOGO_UTSJR.png'),
      'UNAQ': path.join(__dirname, '../frontend/public/img/universidades/LOGO_UNAQ.png')
    };
    
    // Dibujar logos de universidades
    UNIVERSITIES.forEach(uni => {
      doc.rect(xPos, yPos, dataColWidth * aniosArray.length, 30).stroke();
      
      try {
        if (universityImages[uni] && fs.existsSync(universityImages[uni])) {
          doc.image(
            universityImages[uni],
            xPos + 10,
            yPos + 5,
            { fit: [dataColWidth * aniosArray.length - 20, 20], align: 'center' }
          );
        } else {
          doc.text(uni, xPos + 5, yPos + 10, { width: dataColWidth * aniosArray.length - 10, align: 'center' });
        }
      } catch (err) {
        doc.text(uni, xPos + 5, yPos + 10, { width: dataColWidth * aniosArray.length - 10, align: 'center' });
      }
      
      xPos += dataColWidth * aniosArray.length;
    });
    
    // Columna de TOTAL
    doc.rect(xPos, yPos, totalColWidth, 30).stroke();
    doc.text('TOTAL', xPos + 5, yPos + 10, { width: totalColWidth - 10, align: 'center', continued: false });
    
    // Segunda fila: Años bajo universidades
    yPos += 30;
    xPos = 40 + firstColWidth;
    
    UNIVERSITIES.forEach(uni => {
      aniosArray.forEach(year => {
        doc.rect(xPos, yPos, dataColWidth, 30).stroke();
        doc.text(year.toString(), xPos + 5, yPos + 10, { width: dataColWidth - 10, align: 'center' });
        xPos += dataColWidth;
      });
    });
    
    // Columna de totales
    doc.rect(xPos, yPos, totalColWidth, 30).stroke();
    
    // Filas de datos
    yPos += 30;
    
    // Colores para filas alternadas
    const rowColors = ['#ffffff', '#f9f9f9'];
    
    // Para cada semana, crear una fila
    semanasArray.forEach((semana, index) => {
      const rowColor = rowColors[index % 2];
      
      // Si necesitamos una nueva página
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 60; // Reiniciar posición Y
        
        // Repetir encabezados en la nueva página
        doc.fontSize(14).text('Concentrado de Universidades (continuación)', {
          align: 'center'
        });
        doc.moveDown();
        
        // Dibujar el encabezado de nuevo
        doc.rect(40, yPos, pageWidth, 60).fillAndStroke('#f5f5f5', '#cccccc');
        
        // Primera fila: Nombre de universidades
        let xHeader = 40 + firstColWidth;
        doc.fontSize(10).fillColor('#000000');
        doc.text('Semana', 50, yPos + 15, { width: firstColWidth - 20, align: 'center' });
        
        // Dibujar logos de universidades
        UNIVERSITIES.forEach(uni => {
          doc.rect(xHeader, yPos, dataColWidth * aniosArray.length, 30).stroke();
          doc.text(uni, xHeader + 5, yPos + 10, { width: dataColWidth * aniosArray.length - 10, align: 'center' });
          xHeader += dataColWidth * aniosArray.length;
        });
        
        // Columna de TOTAL
        doc.rect(xHeader, yPos, totalColWidth, 30).stroke();
        doc.text('TOTAL', xHeader + 5, yPos + 10, { width: totalColWidth - 10, align: 'center' });
        
        // Segunda fila: Años bajo universidades
        yPos += 30;
        xHeader = 40 + firstColWidth;
        
        UNIVERSITIES.forEach(uni => {
          aniosArray.forEach(year => {
            doc.rect(xHeader, yPos, dataColWidth, 30).stroke();
            doc.text(year.toString(), xHeader + 5, yPos + 10, { width: dataColWidth - 10, align: 'center' });
            xHeader += dataColWidth;
          });
        });
        
        // Columna de totales
        doc.rect(xHeader, yPos, totalColWidth, 30).stroke();
        
        yPos += 30;
      }
      
      // Fondo para la fila
      doc.rect(40, yPos, pageWidth, 30).fill(rowColor);
      
      // Celda de semana
      doc.rect(40, yPos, firstColWidth, 30).stroke();
      doc.fillColor('#000000').text(`S${semana}`, 50, yPos + 10, { width: firstColWidth - 20, align: 'center' });
      
      // Inicializar total de fila
      let rowTotal = 0;
      
      // Celdas de datos
      xPos = 40 + firstColWidth;
      
      UNIVERSITIES.forEach(uni => {
        const uniData = reporteData[uni];
        
        aniosArray.forEach(year => {
          doc.rect(xPos, yPos, dataColWidth, 30).stroke();
          
          // Buscar valor para esta universidad, año y semana
          let value = 0;
          
          if (uniData && uniData.regular) {
            const regularData = uniData.regular.find(
              item => item.semana === semana && item.anio === year
            );
            
            if (regularData) {
              value = regularData.cantidad || 0; // Asegurar que el valor sea un número
            }
          }
          
          // Mostrar valor
          doc.text(value.toString(), xPos + 5, yPos + 10, { width: dataColWidth - 10, align: 'center' });
          
          // Sumar al total de la fila
          rowTotal += value;
          
          xPos += dataColWidth;
        });
      });
      
      // Celda de total de fila
      doc.rect(xPos, yPos, totalColWidth, 30).fillAndStroke('#e6f7ff', '#cccccc');
      doc.text(rowTotal.toString(), xPos + 5, yPos + 10, { width: totalColWidth - 10, align: 'center' });
      
      yPos += 30;
    });
    
    // Fila de totales
    doc.rect(40, yPos, pageWidth, 40).fillAndStroke('#e6f7ff', '#000000');
    doc.rect(40, yPos, firstColWidth, 40).stroke();
    doc.fontSize(12).text('Totales', 50, yPos + 15, { width: firstColWidth - 20, align: 'center' });
    
    // Inicializar total general
    let grandTotal = 0;
    
    // Celdas de totales por columna
    xPos = 40 + firstColWidth;
    
    UNIVERSITIES.forEach(uni => {
      const uniData = reporteData[uni];
      
      aniosArray.forEach(year => {
        doc.rect(xPos, yPos, dataColWidth, 40).stroke();
        
        // Calcular total para esta universidad y año - lógica mejorada
        let columnTotal = 0;
        let found = false;
        
        if (uniData && uniData.acumulado && uniData.acumulado.length > 0) {
          // Buscar el último acumulado para este año
          const acumulados = uniData.acumulado
            .filter(item => item.anio === year && item.semana <= semanasNum)
            .sort((a, b) => b.semana - a.semana);
          
          if (acumulados.length > 0) {
            columnTotal = acumulados[0].acumulado || 0;
            found = true;
          }
        }

        // Si no se encontró en acumulado, calcularlo manualmente
        if (!found && uniData && uniData.regular) {
          columnTotal = uniData.regular
            .filter(item => item.anio === year && item.semana <= semanasNum)
            .reduce((sum, item) => sum + (item.cantidad || 0), 0);
        }
        
        // Imprimir en la consola para depuración (solo la primera universidad)
        if (uniIndex === 0) {
          console.log(`Total para ${uni}, año ${year}: ${columnTotal}`);
        }
        
        // Mostrar total
        doc.fontSize(10).text(columnTotal.toString(), xPos + 5, yPos + 10, { width: dataColWidth - 10, align: 'center' });
        
        // Calcular diferencia si hay más de un año
        if (aniosArray.length > 1 && year === aniosArray[aniosArray.length - 1] && aniosArray.includes(year - 1)) {
          // Buscar valor del año anterior
          let prevColumnTotal = 0;
          
          if (uniData && uniData.acumulado) {
            const prevAcumulados = uniData.acumulado
              .filter(item => item.anio === (year - 1) && item.semana <= semanasNum)
              .sort((a, b) => b.semana - a.semana);
            
            if (prevAcumulados.length > 0 && prevAcumulados[0].acumulado) {
              prevColumnTotal = prevAcumulados[0].acumulado;
            }
          }
          
          // Calcular diferencia
          const diff = columnTotal - prevColumnTotal;
          const diffText = `(${diff > 0 ? '+' : ''}${diff})`;
          
          // Mostrar diferencia
          doc.fontSize(8)
            .fillColor(diff >= 0 ? 'green' : 'red')
            .text(diffText, xPos + 5, yPos + 25, { width: dataColWidth - 10, align: 'center' });
        }
        
        // Sumar al total general
        grandTotal += columnTotal;
        
        xPos += dataColWidth;
      });
    });
    
    // Celda de total general
    doc.rect(xPos, yPos, totalColWidth, 40).fillAndStroke('#e6f7ff', '#000000');
    doc.fontSize(12).fillColor('#000000').text(grandTotal.toString(), xPos + 5, yPos + 15, { width: totalColWidth - 10, align: 'center' });
    
    // Numerar páginas
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      // Eliminar el texto del pie de página
      // Y en su lugar, actualizar el número de página en el encabezado
      const headerText = `Generado por: ${nombreUsuario} | Página ${i + 1} de ${totalPages}`;
      
      // Calcular la posición y - necesitas encontrar la posición exacta según tu layout
      const headerY = 100; // Ajusta este valor según la posición real en tu documento
      
      // Limpiar el área donde estaba el texto anterior
      doc.fillColor('#FFFFFF').rect(doc.page.width - 250, headerY, 200, 20).fill();
      
      // Escribir el nuevo texto con número de página
      doc.fillColor('#000000').text(headerText, doc.page.width - 250, headerY, { align: 'right', width: 200 });
    }
    
    // Finalizar el documento
    doc.end();
    
    // Esperar a que se complete la escritura del documento
    stream.on('finish', () => {
      console.log(`PDF generado correctamente: ${pdfPath}`);
      
      // Leer el PDF generado
      const pdfContent = fs.readFileSync(pdfPath);
      
      // Eliminar el archivo temporal
      fs.unlinkSync(pdfPath);
      
      // Configurar encabezados para descarga
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_${Date.now()}.pdf"`);
      
      // Enviar el PDF
      res.send(pdfContent);
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

const authRoutes = require('./routes/authRoutes');

// Middleware
app.use(cors());
app.use(express.json());

// Configurar servicio de archivos estáticos para imágenes
app.use('/img', express.static(path.join(__dirname, '../frontend/public/img')));

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
    
    let user = null;
    
    // Primero intentamos buscar por correo electrónico
    const [usersByEmail] = await db.query(
      `SELECT u.*, d.cCorreo, d.cNombreCompleto 
       FROM tdUsuario u
       LEFT JOIN tdDetallesUsuario d ON u.iIdUsuario = d.iIdUsuario
       WHERE d.cCorreo = ?`,
      [email]
    );
    
    // Si no encontramos usuario por correo, intentamos por nombre de usuario
    if (usersByEmail.length === 0) {
      console.log('Usuario no encontrado por correo, buscando por nombre de usuario');
      
      const [usersByUsername] = await db.query(
        `SELECT u.*, d.cCorreo, d.cNombreCompleto 
         FROM tdUsuario u
         LEFT JOIN tdDetallesUsuario d ON u.iIdUsuario = d.iIdUsuario
         WHERE u.cNombreUsuario = ?`,
        [email]
      );
      
      if (usersByUsername.length === 0) {
        console.log('Usuario no encontrado');
        return res.status(401).json({ 
          message: 'Credenciales incorrectas' 
        });
      }
      
      user = usersByUsername[0];
    } else {
      user = usersByEmail[0];
    }
    
    // Verificar la contraseña
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
      // Ensure we're using HTTPS for production
      const baseUrl = process.env.API_URL || 'https://siens-api-production.up.railway.app';
      
      // Properly format the image URL
      if (user.cImagen.startsWith('http://') || user.cImagen.startsWith('https://')) {
        // Force HTTPS for security
        safeResponse.user.cImagen = user.cImagen.replace(/^http:\/\//i, 'https://');
      } 
      else if (user.cImagen.startsWith('/img/')) {
        safeResponse.user.cImagen = `${baseUrl}${user.cImagen}`;
      }
      else {
        safeResponse.user.cImagen = `${baseUrl}/img/${user.cImagen}`;
      }
      
      console.log('URL de imagen generada:', safeResponse.user.cImagen);
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

app.use('/api/auth', authRoutes);

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
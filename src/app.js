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

app.get('/api/reportes/pdf', async (req, res) => {
  const pdfFileName = `reporte_${Date.now()}.pdf`;
  const pdfPath = path.join(tmpDir, pdfFileName);
  
  try {
    const { anios, semanas, usuario, fechaLocal, horaLocal } = req.query;
    const nombreUsuario = usuario || 'Usuario'; // Valor por defecto
    
    // Usar fecha y hora enviadas desde el cliente si están disponibles
    const usingClientTime = !!(fechaLocal && horaLocal);
    
    console.log('=== INICIANDO GENERACIÓN DE PDF ===');
    console.log('Parámetros recibidos:', { anios, semanas, usuario, fechaLocal, horaLocal });
    
    // Convertir parámetros a formato adecuado
    const aniosArray = Array.isArray(anios) ? anios.map(Number) : [Number(anios)];
    const semanasNum = Number(semanas);
    
    // Obtener los datos para el reporte
    let reporteData = {};
    try {
      reporteData = await fichaModel.getReporteTodasUniversidades(aniosArray, semanasNum);
      console.log('Datos obtenidos para las universidades:', Object.keys(reporteData));
      console.log('Estructura de datos de ejemplo:');
      if (Object.keys(reporteData).length > 0) {
        const primerUniversidad = Object.keys(reporteData)[0];
        console.log(`Ejemplo de datos para ${primerUniversidad}:`, {
          tieneRegular: !!reporteData[primerUniversidad].regular,
          tieneAcumulado: !!reporteData[primerUniversidad].acumulado,
          cantidadDatosRegular: reporteData[primerUniversidad].regular?.length || 0,
          cantidadDatosAcumulado: reporteData[primerUniversidad].acumulado?.length || 0,
          ejemploRegular: reporteData[primerUniversidad].regular?.[0] || 'No hay datos',
          ejemploAcumulado: reporteData[primerUniversidad].acumulado?.[0] || 'No hay datos'
        });
      }
    } catch (dataError) {
      console.error('Error al obtener datos para el PDF:', dataError);
      reporteData = { UTSJR: { regular: [], acumulado: [] } };
    }
    
    // Obtener la lista de universidades
    const UNIVERSITIES = Object.keys(reporteData);
    console.log('Universidades en los datos:', UNIVERSITIES);
    
    // Crear el documento PDF
    const doc = new PDFDocument({ 
      margin: 40,
      size: 'A4',
      layout: 'landscape', // Para tablas más anchas
      bufferPages: true // Asegúrate de que esto esté habilitado
    });
    
    // Crear un stream para guardar el archivo
    const stream = fs.createWriteStream(pdfPath);
    
    // Pipe el documento al stream de archivo
    doc.pipe(stream);
    
    // Añadir el logo en la esquina superior derecha
    try {
      const logoPath = path.join(__dirname, '../public/general/LOGO_pdf.png');
      
      if (fs.existsSync(logoPath)) {
        console.log('Logo encontrado, añadiendo al PDF');
        
        // Guardar la posición actual
        const currentY = doc.y;
        
        // Calcular las dimensiones adecuadas para el logo
        const maxHeight = 60; // altura máxima del logo
        const maxWidth = 120; // ancho máximo del logo
        
        // Añadir la imagen en la esquina superior derecha
        doc.image(
          logoPath,
          50, // 50 es el margen izquierdo
          50, // 50 es el margen superior
          {
            fit: [maxWidth, maxHeight],
            align: 'left',
            valign: 'top'
          }
        );
        
        // Restaurar la posición Y para continuar con el título
        doc.y = currentY;
      } else {
        console.log('Logo no encontrado en la ruta:', logoPath);
      }
    } catch (logoError) {
      console.error('Error al añadir el logo al PDF:', logoError);
    }

    // Título del reporte
    doc.fontSize(24).text('Concentrado de Universidades', {
      align: 'center'
    });
    
    doc.moveDown();
    
    // Usar fecha y hora del cliente o del servidor
    let formattedDate, formattedTime, timeSource;
    
    if (usingClientTime) {
      // Usar los valores enviados desde el cliente
      formattedDate = fechaLocal;
      formattedTime = horaLocal;
      timeSource = 'Cliente';
    } else {
      // Usar la fecha y hora del servidor
      const serverDate = new Date();
      formattedDate = `${String(serverDate.getDate()).padStart(2, '0')}/${String(serverDate.getMonth() + 1).padStart(2, '0')}/${serverDate.getFullYear()}`;
      formattedTime = `${String(serverDate.getHours()).padStart(2, '0')}:${String(serverDate.getMinutes()).padStart(2, '0')}:${String(serverDate.getSeconds()).padStart(2, '0')}`;
      timeSource = 'Servidor';
    }

    // Información del documento
    doc.fontSize(6)
      .text(`Fecha: ${formattedDate} | Hora: ${formattedTime}`, { align: 'right' })
      .text(`Generado por: ${nombreUsuario}`, { align: 'right' });
    
    doc.moveDown(2);
    
    // Dibujar tabla combinada
    const tableTop = doc.y;
    const tableWidth = doc.page.width - 100; // Ancho total de la tabla
    
    // Calcular el ancho para cada columna
    const cellsCount = 1 + (UNIVERSITIES.length * aniosArray.length);
    const baseColWidth = tableWidth / cellsCount;
    const weekColWidth = baseColWidth;
    const dataColWidth = baseColWidth;
    
    // Función para crear el encabezado de la tabla
    function drawTableHeader() {
      const startY = doc.y;
      
      // Primer nivel de encabezado (universidades)
      let x = 50;
      doc.fillColor('#FFFFFF').rect(x, startY, weekColWidth, 30).fill();
      doc.fillColor('black').fontSize(10).text('Semana', x + 5, startY + 10, { width: weekColWidth - 10, align: 'center' });
      
      x += weekColWidth;
      //images logos
      // Mapa de rutas para las imágenes de universidades
      const universityImages = {
        'UTSJR': path.join(__dirname, '../public/universidades/LOGO_UTSJR.png'),
        'UTC': path.join(__dirname, '../public/universidades/LOGO_UTC.png'),
        'UTEQ': path.join(__dirname, '../public/universidades/LOGO_UTEQ.png'),
        'UNAQ': path.join(__dirname, '../public/universidades/LOGO_UNAQ.png'),
        'UPQ': path.join(__dirname, '../public/universidades/LOGO_UPQ.png'),
        'UPSRJ': path.join(__dirname, '../public/universidades/LOGO_UPSRJ.png')
      };
      
      UNIVERSITIES.forEach(uni => {
        const uniColWidth = dataColWidth * aniosArray.length;
        // Dibuja un fondo para el encabezado
        doc.fillColor('#FFFFFF').rect(x, startY, uniColWidth, 30).fill();
        
        // Intenta cargar y añadir la imagen
        try {
          if (universityImages[uni] && fs.existsSync(universityImages[uni])) {
            // Calcula dimensiones para la imagen (mantener proporción y ajustar al espacio)
            const maxHeight = 25; // altura máxima de la imagen
            const maxWidth = uniColWidth - 10; // ancho máximo con margen
            
            // Dibuja la imagen en el centro del encabezado
            doc.image(
              universityImages[uni], 
              x + (uniColWidth - maxWidth)/2, // centrar horizontalmente
              startY + 2.5, // pequeño margen superior
              { 
                fit: [maxWidth, maxHeight],
                align: 'center',
                valign: 'center'
              }
            );
          } else {
            // Si no existe la imagen, mostrar el nombre como respaldo
            doc.fillColor('black').fontSize(9).text(
              uni, 
              x + 5, 
              startY + 10, 
              { width: uniColWidth - 10, align: 'center' }
            );
          }
        } catch (imgError) {
          console.error(`Error al cargar imagen para ${uni}:`, imgError);
          // Si hay error, mostrar el nombre
          doc.fillColor('black').fontSize(9).text(
            uni, 
            x + 5, 
            startY + 10, 
            { width: uniColWidth - 10, align: 'center' }
          );
        }
        
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
    // Encontrar todas las semanas únicas - con manejo más detallado
    const allSemanas = new Set();

    // Primero, comprueba si hay datos para depuración
    let hayDatosParaAlgunaUniversidad = false;

    Object.entries(reporteData).forEach(([universidad, datos]) => {
      console.log(`Procesando datos para ${universidad}:`);
      
      if (!datos) {
        console.log(`- No hay datos para ${universidad}`);
        return;
      }
      
      // Verificar si hay datos regulares
      if (!datos.regular || !Array.isArray(datos.regular) || datos.regular.length === 0) {
        console.log(`- No hay datos regulares para ${universidad}`);
      } else {
        console.log(`- Hay ${datos.regular.length} registros regulares para ${universidad}`);
        hayDatosParaAlgunaUniversidad = true;
        
        // Extraer semanas de datos regulares
        datos.regular.forEach(item => {
          if (item && typeof item.semana === 'number' && item.semana <= semanasNum) {
            allSemanas.add(item.semana);
            console.log(`  - Añadida semana ${item.semana} de datos regulares`);
          } else if (item) {
            console.log(`  - Dato regular inválido: ${JSON.stringify(item)}`);
          }
        });
      }
    });

    // Si no hay semanas detectadas, crear semanas manualmente
    if (allSemanas.size === 0) {
      console.log('No se detectaron semanas en los datos. Creando semanas manualmente...');
      
      if (hayDatosParaAlgunaUniversidad) {
        console.log('Hay datos pero no se detectaron semanas correctamente. Posible problema de estructura.');
      } else {
        console.log('No hay datos para ninguna universidad. Creando semanas de respaldo.');
      }
      
      // Crear semanas manualmente del 1 al número de semanas solicitado
      for (let i = 1; i <= semanasNum; i++) {
        allSemanas.add(i);
        console.log(`Añadida semana ${i} manualmente`);
      }
    }
    
    // Convertir a array y ordenar
    const uniqueSemanas = Array.from(allSemanas).sort((a, b) => a - b);
    console.log('Semanas únicas detectadas finalmente:', uniqueSemanas);
    console.log('Total de semanas a dibujar:', uniqueSemanas.length);

    // 3. En la parte donde se dibujan las filas de datos, asegúrate de manejar datos vacíos
    uniqueSemanas.forEach((semana, index) => {
      // Log por cada semana para ser más exhaustivos en la depuración
      console.log(`Dibujando semana ${semana} (fila ${index + 1} de ${uniqueSemanas.length})`);
      
      // Verificar si necesitamos una nueva página
      if (currentY > doc.page.height - 100) {
        //doc.addPage();
        currentY = drawTableHeader(); // Redibuja los encabezados en la nueva página
        console.log('Añadida nueva página, nueva posición Y:', currentY);
      }
      
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
          // Buscar datos para esta semana y año (con más logs)
          let value = 0;
          let dataFound = false;
          
          if (uniData && uniData.regular && Array.isArray(uniData.regular)) {
            const data = uniData.regular.find(item => 
              item && item.semana === semana && item.anio === year
            );
            
            if (data) {
              value = data.cantidad || 0;
              dataFound = true;
            }
          }
          
          // Si es la primera universidad o la última semana, log para depuración
          if (uni === UNIVERSITIES[0] || index === uniqueSemanas.length - 1) {
            console.log(`  - Valor para ${uni}, año ${year}, semana ${semana}: ${value} (${dataFound ? 'encontrado' : 'no encontrado'})`);
          }
          
          doc.fillColor('black').fontSize(9).text(value.toString(), x + 5, rowY + 5, { width: dataColWidth - 10, align: 'center' });
          x += dataColWidth;
        });
      });
      
      currentY += 20; // Incrementar la posición Y para la siguiente fila
      
      // Asegurarse de dibujar las líneas horizontales para cada fila
      doc.moveTo(50, currentY).lineTo(50 + tableWidth, currentY).stroke();
    });
    
    // Después de todas las filas de datos, verifica si necesitas una nueva página para los totales
    if (currentY > doc.page.height - 100) {
      //doc.addPage();
      currentY = drawTableHeader(); // Redibuja los encabezados en la nueva página
      console.log('Añadida nueva página para totales, nueva posición Y:', currentY);
    }
    
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
    
    // Líneas verticales para las columnas de año
    x = 50 + weekColWidth;
    UNIVERSITIES.forEach(uni => {
      for (let i = 0; i < aniosArray.length; i++) {
        doc.moveTo(x, tableTop + 30).lineTo(x, totalsRowY + 25).stroke();
        x += dataColWidth;
      }
    });
    
    console.log('=== FINALIZANDO PDF ===');
    console.log('Posición Y final:', totalsRowY + 25);
    console.log('Altura de página:', doc.page.height);
    
    // Numerar páginas
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(6).text(`Página ${i + 1} de ${totalPages}`, 50, doc.page.height - 50, { align: 'center' });
    }
    
    // Finalizar el documento
    doc.end();
    
    // Esperar a que se complete la escritura del documento
    stream.on('finish', () => {
      console.log(`PDF generado correctamente: ${pdfPath}`);
      console.log(`Tamaño del archivo PDF: ${fs.statSync(pdfPath).size} bytes`);
      
      // En lugar de devolver una URL:
      const pdfContent = fs.readFileSync(pdfPath);
      
      // Eliminar el archivo temporal inmediatamente después de leerlo
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
    
    // If existe cImagen, añadirla al objeto de respuesta con la ruta completa
    if (user.cImagen) {
      // Ensure we're using HTTPS for production
      const baseUrl = process.env.API_URL || 'https://siens-api-production.up.railway.app';
      
      // Properly format the image URL
      // If it's already a full URL
      if (user.cImagen.startsWith('http://') || user.cImagen.startsWith('https://')) {
        // Force HTTPS for security
        safeResponse.user.cImagen = user.cImagen.replace(/^http:\/\//i, 'https://');
      } 
      // If it starts with /images/ 
      else if (user.cImagen.startsWith('/images/')) {
        safeResponse.user.cImagen = `${baseUrl}${user.cImagen}`;
      }
      // Otherwise it's just a filename
      else {
        safeResponse.user.cImagen = `${baseUrl}/images/${user.cImagen}`;
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
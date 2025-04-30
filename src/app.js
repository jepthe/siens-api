// src/app.js
const axios = require("axios");
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./config/db");

require("dotenv").config();
const PRODUCTION_URL = process.env.API_URL || "https://sies-image-server-production.up.railway.app"; //por si no se define la variable de entorno, resuelve imagen perfil

const app = express();

// Importar moment-timezone al inicio del archivo
const moment = require("moment-timezone");

//pdf
// En el backend (app.js)
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fichaModel = require("./models/fichaModel");

// Asegurarse de que el directorio tmp exista
const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

// Configurar ruta para servir archivos PDF temporales
app.use("/tmp", express.static(path.join(__dirname, "../tmp")));

// Endpoint para generar PDF
// Solución completa para el endpoint de generación de PDF

// En app.js - Modificar la función de generación de PDF
app.get("/api/reportes/pdf", async (req, res) => {
  const pdfFileName = `reporte_${Date.now()}.pdf`;
  const pdfPath = path.join(tmpDir, pdfFileName);

  try {
    // Configuración de la URL base del servidor de imágenes
    /*const IMAGE_SERVER_URL = process.env.IMAGE_SERVER_URL || "https://sies-image-server-production.up.railway.app";
    
    // Mapeo de nombres de universidades a sus URLs
    const universityImageUrls = {
      UPQ: `${IMAGE_SERVER_URL}/img/universidades/LOGO_UPQ.png`,
      UPSRJ: `${IMAGE_SERVER_URL}/img/universidades/LOGO_UPSRJ.png`,
      UTEQ: `${IMAGE_SERVER_URL}/img/universidades/LOGO_UTEQ.png`,
      UTC: `${IMAGE_SERVER_URL}/img/universidades/LOGO_UTC.png`,
      UTSJR: `${IMAGE_SERVER_URL}/img/universidades/LOGO_UTSJR.png`,
      UNAQ: `${IMAGE_SERVER_URL}/img/universidades/LOGO_UNAQ.png`
    };
    
    // URL para el logo del PDF
    //const pdfLogoUrl = `${IMAGE_SERVER_URL}/img/general/LOGO_pdf.png`;
    
    // Función para descargar imagen
    const downloadImage = async (url) => {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer'
        });
        return Buffer.from(response.data, 'binary');
      } catch (error) {
        console.error('Error descargando imagen:', url, error.message);
        return null;
      }
    };
    
    // Descargar todas las imágenes necesarias al inicio
    console.log("Descargando imágenes...");
    
    // Objeto para almacenar los buffers de imágenes
    const imageBuffers = {
     
    };
    
    // Descargar logos de universidades
    for (const [uni, url] of Object.entries(universityImageUrls)) {
      imageBuffers[uni] = await downloadImage(url);
      console.log(`Imagen de ${uni} ${imageBuffers[uni] ? 'descargada' : 'falló'}`);
    }*/
    const { anios, semanas, usuario, timezone, viewType } = req.query;
    const nombreUsuario = usuario || "Usuario"; // Valor por defecto
    const formatoVista = viewType || "bySemana"; // Por defecto usa el formato por semana

    console.log("=== INICIANDO GENERACIÓN DE PDF ===");
    console.log("Parámetros recibidos:", {
      anios,
      semanas,
      usuario,
      timezone,
      viewType,
    });

    // Convertir parámetros a formato adecuado
    const aniosArray = Array.isArray(anios)
      ? anios.map(Number)
      : [Number(anios)];
    const semanasNum = Number(semanas);

    // Obtener los datos para el reporte
    let reporteData = {};
    try {
      reporteData = await fichaModel.getReporteTodasUniversidades(
        aniosArray,
        semanasNum
      );
    } catch (dataError) {
      console.error("Error al obtener datos para el PDF:", dataError);
      reporteData = {};
    }

    // Obtener la lista de universidades
    const UNIVERSITIES = Object.keys(reporteData);

    // Configuración de la URL base del servidor de imágenes
    const IMAGE_SERVER_URL =
      process.env.IMAGE_SERVER_URL || "https://sies-image-server-production.up.railway.app";

    // Crear mapeo de universidades a URLs de manera dinámica
    const universityImageUrls = {};
    UNIVERSITIES.forEach((uni) => {
      universityImageUrls[
        uni
      ] = `${IMAGE_SERVER_URL}/img/universidades/LOGO_${uni}.png`;
    });

    // Función para descargar imagen
    const downloadImage = async (url) => {
      try {
        const response = await axios.get(url, {
          responseType: "arraybuffer",
        });
        return Buffer.from(response.data, "binary");
      } catch (error) {
        console.error("Error descargando imagen:", url, error.message);
        return null;
      }
    };

    // Objeto para almacenar los buffers de imágenes
    const imageBuffers = {};

    // Descargar logos de universidades
    for (const [uni, url] of Object.entries(universityImageUrls)) {
      imageBuffers[uni] = await downloadImage(url);
      console.log(
        `Imagen de ${uni} ${imageBuffers[uni] ? "descargada" : "falló"}`
      );
    }

    // Crear el documento PDF
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "landscape", // Para tablas más anchas
      bufferPages: true,
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
        const serverOffset = (clientDate.getTimezoneOffset() * -1) / 60;
        const offsetDiff = clientOffset - serverOffset;

        clientDate.setHours(clientDate.getHours() + offsetDiff);

        formattedDate = `${String(clientDate.getDate()).padStart(
          2,
          "0"
        )}/${String(clientDate.getMonth() + 1).padStart(
          2,
          "0"
        )}/${clientDate.getFullYear()}`;
        formattedTime = `${String(clientDate.getHours()).padStart(
          2,
          "0"
        )}:${String(clientDate.getMinutes()).padStart(2, "0")}:${String(
          clientDate.getSeconds()
        ).padStart(2, "0")}`;
      } else {
        const serverDate = new Date();
        formattedDate = `${String(serverDate.getDate()).padStart(
          2,
          "0"
        )}/${String(serverDate.getMonth() + 1).padStart(
          2,
          "0"
        )}/${serverDate.getFullYear()}`;
        formattedTime = `${String(serverDate.getHours()).padStart(
          2,
          "0"
        )}:${String(serverDate.getMinutes()).padStart(2, "0")}:${String(
          serverDate.getSeconds()
        ).padStart(2, "0")}`;
      }
    } catch (timeError) {
      const fallbackDate = new Date();
      formattedDate = `${String(fallbackDate.getDate()).padStart(
        2,
        "0"
      )}/${String(fallbackDate.getMonth() + 1).padStart(
        2,
        "0"
      )}/${fallbackDate.getFullYear()}`;
      formattedTime = `${String(fallbackDate.getHours()).padStart(
        2,
        "0"
      )}:${String(fallbackDate.getMinutes()).padStart(2, "0")}:${String(
        fallbackDate.getSeconds()
      ).padStart(2, "0")}`;
    }

    // Generar PDF según el tipo de vista
    if (formatoVista === "bySemana") {
      // Para cada página de un PDF, añadir encabezado común con logo
      const addCommonHeader = (
        isFirstPage = false,
        pageNumber = 1,
        totalPages = 1
      ) => {
        // Añadir el logo en la esquina superior izquierda (solo primera página)
        if (isFirstPage) {
          try {
            const logoPath = path.join(
              __dirname,
              "../frontend/public/img/general/LOGO_pdf.png"
            );

            if (fs.existsSync(logoPath)) {
              doc.image(
                logoPath,
                50, // margen izquierdo
                50, // margen superior
                {
                  fit: [100, 50],
                  align: "left",
                  valign: "top",
                }
              );
            }
          } catch (logoError) {
            console.error("Error al añadir el logo al PDF:", logoError);
          }
        }

        // Título del reporte (primera página o versión reducida para continuación)
        if (isFirstPage) {
          doc.fontSize(24).text("Concentrado de Universidades", {
            align: "center",
          });

          doc.moveDown();

          // Información del documento
          doc
            .fontSize(10)
            .text(
              `Fecha: ${formattedDate} | Hora: ${formattedTime} | Página ${pageNumber} de ${totalPages}`,
              {
                align: "right",
              }
            )
            .text(`Generado por: ${nombreUsuario}`, { align: "right" });

          doc.moveDown(2);
        } else {
          doc.fontSize(14).text("Concentrado de Universidades (continuación)", {
            align: "center",
          });

          // Añadir información de página en páginas adicionales
          doc.fontSize(10).text(`Página ${pageNumber} de ${totalPages}`, {
            align: "right",
          });

          doc.moveDown();
        }
      };

      // Añadir encabezado común para la primera página

      // *** VISTA POR SEMANA: Crear tabla optimizada en una sola página ***

      // Determinar todas las semanas disponibles hasta el límite seleccionado
      const semanasArray = Array.from({ length: semanasNum }, (_, i) => i + 1);
      // Calcular el número total estimado de páginas basado en datos
      let currentPage = 1;
      let totalPages = Math.ceil(semanasArray.length / 15) || 1; // Estimación inicial
      addCommonHeader(true, currentPage, totalPages);
      // Calcular ancho de las columnas //resize
      const pageWidth = doc.page.width - 60; // 40px de margen en cada lado
      const firstColWidth = 60; // Ancho de la primera columna (semanas)
      const totalColWidth = 60; // Ancho de la columna de totales
      const dataColWidth =
        (pageWidth - firstColWidth - totalColWidth) /
        (UNIVERSITIES.length * aniosArray.length);

      // Posición vertical actual
      let yPos = doc.y;

      // Dibujar encabezado de la tabla
      doc.rect(40, yPos, pageWidth, 60).fillAndStroke("#f5f5f5", "#cccccc"); // Fondo gris claro

      // Primera fila: Nombre de universidades
      let xPos = 40 + firstColWidth;
      doc.fontSize(10).fillColor("#000000");
      doc.text("Semana", 50, yPos + 15, {
        width: firstColWidth - 20,
        align: "center",
      });

      // Dibujar logos de universidades
      UNIVERSITIES.forEach((uni) => {
        doc.rect(xPos, yPos, dataColWidth * aniosArray.length, 30).stroke();

        try {
          if (imageBuffers[uni]) {
            doc.image(imageBuffers[uni], xPos + 10, yPos + 5, {
              fit: [dataColWidth * aniosArray.length - 20, 20],
              align: "center",
            });
          } else {
            doc.text(uni, xPos + 5, yPos + 10, {
              width: dataColWidth * aniosArray.length - 10,
              align: "center",
            });
          }
        } catch (err) {
          doc.text(uni, xPos + 5, yPos + 10, {
            width: dataColWidth * aniosArray.length - 10,
            align: "center",
          });
        }

        xPos += dataColWidth * aniosArray.length;
      });

      // Columna de TOTAL
      doc.rect(xPos, yPos, totalColWidth, 30).stroke();
      doc.text("TOTAL", xPos + 5, yPos + 10, {
        width: totalColWidth - 10,
        align: "center",
        continued: false,
      });

      // Segunda fila: Años bajo universidades
      yPos += 30;
      xPos = 40 + firstColWidth;

      UNIVERSITIES.forEach((uni) => {
        aniosArray.forEach((year) => {
          doc.rect(xPos, yPos, dataColWidth, 30).stroke();
          doc.text(year.toString(), xPos + 5, yPos + 10, {
            width: dataColWidth - 10,
            align: "center",
          });
          xPos += dataColWidth;
        });
      });

      // Columna de totales
      doc.rect(xPos, yPos, totalColWidth, 30).stroke();

      // Filas de datos
      yPos += 30;

      // Colores para filas alternadas
      const rowColors = ["#ffffff", "#f9f9f9"];

      // Para cada semana, crear una fila
      semanasArray.forEach((semana, index) => {
        const rowColor = rowColors[index % 2];

        // Si necesitamos una nueva página
        if (yPos > doc.page.height - 100) {
          doc.addPage();
          currentPage++;
          // Actualizar el total de páginas si es necesario
          totalPages = Math.max(totalPages, currentPage);
          yPos = 70; // Reiniciar posición Y

          // Añadir encabezados comunes para páginas adicionales
          addCommonHeader(false, currentPage, totalPages);

          // Dibujar el encabezado de nuevo
          doc.rect(40, yPos, pageWidth, 60).fillAndStroke("#f5f5f5", "#cccccc");

          // Primera fila: Nombre de universidades
          let xHeader = 40 + firstColWidth;
          doc.fontSize(10).fillColor("#000000");
          doc.text("Semana", 50, yPos + 15, {
            width: firstColWidth - 20,
            align: "center",
          });

          // Dibujar logos de universidades
          UNIVERSITIES.forEach((uni) => {
            doc
              .rect(xHeader, yPos, dataColWidth * aniosArray.length, 30)
              .stroke();
            doc.text(uni, xHeader + 5, yPos + 10, {
              width: dataColWidth * aniosArray.length - 10,
              align: "center",
            });
            xHeader += dataColWidth * aniosArray.length;
          });

          // Columna de TOTAL
          doc.rect(xHeader, yPos, totalColWidth, 30).stroke();
          doc.text("TOTAL", xHeader + 5, yPos + 10, {
            width: totalColWidth - 10,
            align: "center",
          });

          // Segunda fila: Años bajo universidades
          yPos += 30;
          xHeader = 40 + firstColWidth;

          UNIVERSITIES.forEach((uni) => {
            aniosArray.forEach((year) => {
              doc.rect(xHeader, yPos, dataColWidth, 30).stroke();
              doc.text(year.toString(), xHeader + 5, yPos + 10, {
                width: dataColWidth - 10,
                align: "center",
              });
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
        doc.fillColor("#000000").text(`S${semana}`, 50, yPos + 10, {
          width: firstColWidth - 20,
          align: "center",
        });

        // Inicializar total de fila
        let rowTotal = 0;

        // Celdas de datos
        xPos = 40 + firstColWidth;

        UNIVERSITIES.forEach((uni) => {
          const uniData = reporteData[uni];

          aniosArray.forEach((year) => {
            doc.rect(xPos, yPos, dataColWidth, 30).stroke();

            // Buscar valor para esta universidad, año y semana
            let value = 0;

            if (uniData && uniData.regular) {
              // Buscar todos los registros para esta combinación y sumarlos
              const regularDataItems = uniData.regular.filter(
                (item) => item.semana === semana && item.anio === year
              );

              // Sumar todos los valores
              value = regularDataItems.reduce(
                (sum, item) =>
                  sum +
                  (typeof item.cantidad === "number"
                    ? Number(item.cantidad)
                    : 0),
                0
              );
            }

            // Mostrar valor
            doc.text(value.toString(), xPos + 5, yPos + 10, {
              width: dataColWidth - 10,
              align: "center",
            });

            // Sumar al total de la fila
            rowTotal += value;

            xPos += dataColWidth;
          });
        });

        // Celda de total de fila
        doc
          .rect(xPos, yPos, totalColWidth, 30)
          .fillAndStroke("#e6f7ff", "#cccccc");
        doc.fillColor("#000000"); // Establecer explícitamente el color del texto a negro
        doc.text(rowTotal.toString(), xPos + 5, yPos + 10, {
          width: totalColWidth - 10,
          align: "center",
        });

        yPos += 30;
      });

      // Fila de totales
      doc.rect(40, yPos, pageWidth, 40).fillAndStroke("#e6f7ff", "#000000");
      doc.fillColor("#000000");
      doc.rect(40, yPos, firstColWidth, 40).stroke();
      doc.fontSize(12).text("Totales", 50, yPos + 15, {
        width: firstColWidth - 20,
        align: "center",
      });

      // Inicializar total general
      let grandTotal = 0;

      // Celdas de totales por columna
      xPos = 40 + firstColWidth;

      UNIVERSITIES.forEach((uni) => {
        const uniData = reporteData[uni];

        aniosArray.forEach((year) => {
          doc.rect(xPos, yPos, dataColWidth, 40).stroke();

          // Calcular total para esta universidad y año usando regular en lugar de acumulado
          let columnTotal = 0;

          if (uniData && uniData.regular) {
            // Sumar todos los valores regulares para esta universidad y año
            const regularItems = uniData.regular.filter(
              (item) => item.anio === year && item.semana <= semanasNum
            );

            columnTotal = regularItems.reduce(
              (sum, item) =>
                sum +
                (typeof item.cantidad === "number" ? Number(item.cantidad) : 0),
              0
            );
          }

          // Mostrar total
          doc
            .fontSize(10)
            .fillColor("#000000")
            .text(columnTotal.toString(), xPos + 5, yPos + 10, {
              width: dataColWidth - 10,
              align: "center",
            });

          // Calcular diferencia si hay más de un año
          if (
            aniosArray.length > 1 &&
            year === aniosArray[aniosArray.length - 1] &&
            aniosArray.includes(year - 1)
          ) {
            // Buscar valor del año anterior
            let prevColumnTotal = 0;

            if (uniData && uniData.regular) {
              const prevRegularItems = uniData.regular.filter(
                (item) => item.anio === year - 1 && item.semana <= semanasNum
              );

              prevColumnTotal = prevRegularItems.reduce(
                (sum, item) =>
                  sum +
                  (typeof item.cantidad === "number"
                    ? Number(item.cantidad)
                    : 0),
                0
              );
            }

            // Calcular diferencia
            const diff = columnTotal - prevColumnTotal;
            const diffText = `(${diff > 0 ? "+" : ""}${diff})`;

            // Mostrar diferencia
            doc
              .fontSize(8)
              .fillColor(diff >= 0 ? "green" : "red")
              .text(diffText, xPos + 5, yPos + 25, {
                width: dataColWidth - 10,
                align: "center",
              });
          }

          // Sumar al total general
          grandTotal += columnTotal;

          xPos += dataColWidth;
        });
      });

      // Celda de total general
      doc
        .rect(xPos, yPos, totalColWidth, 40)
        .fillAndStroke("#e6f7ff", "#000000");
      doc
        .fontSize(12)
        .fillColor("#000000")
        .text(grandTotal.toString(), xPos + 5, yPos + 15, {
          width: totalColWidth - 10,
          align: "center",
        });
    } else if (formatoVista === "byUniversidad") {
      // *** VISTA POR UNIVERSIDAD: Crear tabla optimizada con universidades en filas y semanas en columnas ***

      // Determinar todas las semanas disponibles hasta el límite seleccionado
      const semanasArray = Array.from({ length: semanasNum }, (_, i) => i + 1);

      // Forzar un máximo de 10 semanas por página para mejor legibilidad
      const MAX_SEMANAS_PER_PAGE = 10;

      // Precalcular totales por universidad y año para todas las semanas
      const totalsPorUniversidad = {};

      UNIVERSITIES.forEach((uni) => {
        totalsPorUniversidad[uni] = {};

        aniosArray.forEach((year) => {
          // Calcular total para esta universidad y año a través de todas las semanas
          let uniYearTotal = 0;

          if (reporteData[uni] && reporteData[uni].regular) {
            const regularItems = reporteData[uni].regular.filter(
              (item) => item.anio === year && item.semana <= semanasNum
            );

            uniYearTotal = regularItems.reduce(
              (sum, item) =>
                sum +
                (typeof item.cantidad === "number" ? Number(item.cantidad) : 0),
              0
            );
          }

          totalsPorUniversidad[uni][year] = uniYearTotal;
        });
      });

      // Calcular totales por semana/año
      const totalsPorSemanaAnio = {};

      semanasArray.forEach((semana) => {
        totalsPorSemanaAnio[semana] = {};

        aniosArray.forEach((year) => {
          let semanaYearTotal = 0;

          UNIVERSITIES.forEach((uni) => {
            if (reporteData[uni] && reporteData[uni].regular) {
              const regularDataItems = reporteData[uni].regular.filter(
                (item) => item.semana === semana && item.anio === year
              );

              semanaYearTotal += regularDataItems.reduce(
                (sum, item) =>
                  sum +
                  (typeof item.cantidad === "number"
                    ? Number(item.cantidad)
                    : 0),
                0
              );
            }
          });

          totalsPorSemanaAnio[semana][year] = semanaYearTotal;
        });
      });

      // Calcular gran total general
      let grandTotal = 0;
      Object.values(totalsPorUniversidad).forEach((uniTotals) => {
        Object.values(uniTotals).forEach((total) => {
          grandTotal += total;
        });
      });

      // Dividir las semanas en grupos para diferentes páginas
      const semanaGroups = [];
      for (let i = 0; i < semanasArray.length; i += MAX_SEMANAS_PER_PAGE) {
        semanaGroups.push(semanasArray.slice(i, i + MAX_SEMANAS_PER_PAGE));
      }

      console.log(
        `Dividiendo ${semanasArray.length} semanas en ${semanaGroups.length} páginas (máx ${MAX_SEMANAS_PER_PAGE} por página)`
      );

      // Para cada grupo de semanas, crear una página
      semanaGroups.forEach((currentSemanas, pageIndex) => {
        const isLastPage = pageIndex === semanaGroups.length - 1;

        // Si no es la primera página, agregar una nueva
        if (pageIndex > 0) {
          doc.addPage();
        }

        // Posición vertical actual para esta página
        let yPos = 100; // Dejar espacio para encabezado

        // Añadir encabezado con logo para la primera página
        if (pageIndex === 0) {
          try {
            const logoPath = path.join(
              __dirname,
              "../frontend/public/img/general/LOGO_pdf.png"
            );

            if (fs.existsSync(logoPath)) {
              doc.image(
                logoPath,
                50, // margen izquierdo
                50, // margen superior
                {
                  fit: [100, 50],
                  align: "left",
                  valign: "top",
                }
              );
            }
          } catch (logoError) {
            console.error("Error al añadir el logo al PDF:", logoError);
          }

          // Título del reporte
          doc.fontSize(24).text("Concentrado de Universidades", {
            align: "center",
          });

          doc.moveDown();

          // Información del documento
          doc
            .fontSize(10)
            .text(
              `Fecha: ${formattedDate} | Hora: ${formattedTime} | Página ${
                pageIndex + 1
              } de ${semanaGroups.length}`,
              {
                align: "right",
              }
            )
            .text(`Generado por: ${nombreUsuario}`, { align: "right" });

          // Indicar rango de semanas en esta página
          if (semanaGroups.length > 1) {
            doc
              .fontSize(12)
              .text(
                `Semanas: ${currentSemanas[0]} - ${
                  currentSemanas[currentSemanas.length - 1]
                } de ${semanasNum}`,
                {
                  align: "center",
                }
              );
          }

          doc.moveDown();
          yPos = doc.y;
        } else {
          // Título para páginas adicionales
          doc.fontSize(14).text(`Concentrado de Universidades (continuación)`, {
            align: "center",
          });

          // Agregar información de página
          doc
            .fontSize(10)
            .text(`Página ${pageIndex + 1} de ${semanaGroups.length}`, {
              align: "right",
            });

          // Indicar rango de semanas en esta página
          doc
            .fontSize(12)
            .text(
              `Semanas: ${currentSemanas[0]} - ${
                currentSemanas[currentSemanas.length - 1]
              } de ${semanasNum}`,
              {
                align: "center",
              }
            );

          doc.moveDown();
          yPos = doc.y;
        }

        // Calcular ancho de las columnas para este grupo de semanas
        const pageWidth = doc.page.width - 60; // 30px de margen en cada lado
        const firstColWidth = 60; // Ancho de la primera columna (universidades)
        const totalColWidth = 60; // Ancho de la columna de totales (solo en última página)

        // Calcular el ancho total de la tabla para esta página
        const tableWidth = isLastPage
          ? pageWidth // En la última página, incluye la columna de totales
          : pageWidth; // En páginas intermedias, ocupa todo el ancho disponible

        // Ancho disponible para datos (semanas)
        const availableWidth = isLastPage
          ? pageWidth - firstColWidth - totalColWidth // Reservar espacio para totales en última página
          : pageWidth - firstColWidth; // Usar todo el espacio en páginas intermedias

        const dataColWidth =
          availableWidth / (currentSemanas.length * aniosArray.length);

        // Dibujar encabezado de la tabla (el fondo gris cubre toda la tabla)
        doc.rect(40, yPos, tableWidth, 60).fillAndStroke("#f5f5f5", "#cccccc");

        // Primera fila: Nombre de semanas
        let xPos = 40 + firstColWidth;
        doc.fontSize(8).fillColor("#000000");
        doc.text("Universidad", 45, yPos + 15, {
          width: firstColWidth - 10,
          align: "center",
        });

        // Dibujar encabezados de semanas para este grupo
        currentSemanas.forEach((semana) => {
          doc.rect(xPos, yPos, dataColWidth * aniosArray.length, 30).stroke();
          doc.text(`S${semana}`, xPos + 2, yPos + 10, {
            width: dataColWidth * aniosArray.length - 4,
            align: "center",
          });
          xPos += dataColWidth * aniosArray.length;
        });

        // Columna de TOTAL (solo en última página)
        if (isLastPage) {
          doc.rect(xPos, yPos, totalColWidth, 30).stroke();
          doc.text("TOTAL", xPos + 5, yPos + 10, {
            width: totalColWidth - 10,
            align: "center",
          });
        }

        // Segunda fila: Años bajo semanas
        yPos += 30;
        xPos = 40 + firstColWidth;

        currentSemanas.forEach((semana) => {
          aniosArray.forEach((year) => {
            doc.rect(xPos, yPos, dataColWidth, 30).stroke();

            // Dibujar el texto horizontalmente (sin rotación)
            doc
              .fillColor("#000000")
              .fontSize(7)
              .text(year.toString(), xPos + 2, yPos + 10, {
                width: dataColWidth - 4,
                align: "center",
              });

            xPos += dataColWidth;
          });
        });

        // Columna de totales (solo en última página)
        if (isLastPage) {
          doc.rect(xPos, yPos, totalColWidth, 30).stroke();
        }

        // Filas de datos
        yPos += 30;

        // Colores para filas alternadas
        const rowColors = ["#ffffff", "#f9f9f9"];

        // Para cada universidad, crear una fila
        UNIVERSITIES.forEach((uni, index) => {
          const rowColor = rowColors[index % 2];

          // Si necesitamos una nueva página vertical
          if (yPos > doc.page.height - 100) {
            doc.addPage();
            yPos = 60; // Reiniciar posición Y

            // Aquí se implementaría la repetición de encabezados para continuación vertical si es necesario
          }

          // Fondo para la fila (cubre todo el ancho de la tabla)
          doc.rect(40, yPos, tableWidth, 25).fill(rowColor);

          // Celda de universidad
          doc.rect(40, yPos, firstColWidth, 25).stroke();
          try {
            if (imageBuffers[uni]) {
              // Si tenemos la imagen cargada, usarla
              doc.image(imageBuffers[uni], 40 + 2, yPos + 2, {
                fit: [firstColWidth - 4, 21],
                align: "center",
                valign: "center",
              });
            } else {
              // Si no hay imagen, mostrar el texto
              doc
                .fillColor("#000000")
                .fontSize(8)
                .text(uni, 45, yPos + 8, {
                  width: firstColWidth - 10,
                  align: "center",
                });
            }
          } catch (err) {
            // En caso de error, mostrar el texto
            doc
              .fillColor("#000000")
              .fontSize(8)
              .text(uni, 45, yPos + 8, {
                width: firstColWidth - 10,
                align: "center",
              });
          }

          // Celdas de datos
          xPos = 40 + firstColWidth;

          currentSemanas.forEach((semana) => {
            aniosArray.forEach((year) => {
              doc.rect(xPos, yPos, dataColWidth, 25).stroke();

              // Buscar valor para esta universidad, semana y año
              let value = 0;

              if (reporteData[uni] && reporteData[uni].regular) {
                const regularDataItems = reporteData[uni].regular.filter(
                  (item) => item.semana === semana && item.anio === year
                );

                value = regularDataItems.reduce(
                  (sum, item) =>
                    sum +
                    (typeof item.cantidad === "number"
                      ? Number(item.cantidad)
                      : 0),
                  0
                );
              }

              // Mostrar valor con fuente más pequeña
              doc
                .fillColor("#000000")
                .fontSize(7)
                .text(value.toString(), xPos + 2, yPos + 9, {
                  width: dataColWidth - 4,
                  align: "center",
                });

              xPos += dataColWidth;
            });
          });

          // Celda de total de fila (solo en última página)
          if (isLastPage) {
            // Total por universidad sumando todos los años
            let uniTotal = 0;
            aniosArray.forEach((year) => {
              uniTotal += totalsPorUniversidad[uni][year] || 0;
            });

            doc
              .rect(xPos, yPos, totalColWidth, 25)
              .fillAndStroke("#e6f7ff", "#cccccc");
            doc
              .fillColor("#000000")
              .fontSize(8)
              .text(uniTotal.toString(), xPos + 5, yPos + 8, {
                width: totalColWidth - 10,
                align: "center",
              });
          }

          yPos += 25;
        });

        // Fila de totales (fondo azul para toda la fila)
        doc.rect(40, yPos, tableWidth, 35).fillAndStroke("#e6f7ff", "#000000");
        doc.fillColor("#000000");
        doc.rect(40, yPos, firstColWidth, 35).stroke();
        doc.fontSize(9).text("Totales", 45, yPos + 12, {
          width: firstColWidth - 10,
          align: "center",
        });

        // Celdas de totales por columna
        xPos = 40 + firstColWidth;

        currentSemanas.forEach((semana) => {
          aniosArray.forEach((year) => {
            doc.rect(xPos, yPos, dataColWidth, 35).stroke();

            // Calcular total para esta semana y año
            const columnTotal = totalsPorSemanaAnio[semana][year] || 0;

            // Mostrar total
            doc
              .fillColor("#000000")
              .fontSize(8)
              .text(columnTotal.toString(), xPos + 2, yPos + 10, {
                width: dataColWidth - 4,
                align: "center",
              });

            xPos += dataColWidth;
          });
        });

        // Celda de total general (solo en última página)
        if (isLastPage) {
          doc
            .rect(xPos, yPos, totalColWidth, 35)
            .fillAndStroke("#e6f7ff", "#000000");
          doc
            .fillColor("#000000")
            .fontSize(9)
            .text(grandTotal.toString(), xPos + 5, yPos + 12, {
              width: totalColWidth - 10,
              align: "center",
            });
        }
      });
    }

    /*// Numerar páginas
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor("#000000")
        .text(`Página ${i + 1} de ${totalPages}`, 40, doc.page.height - 40, {
          align: "center",
        });
    }*/

    // Finalizar el documento
    doc.end();

    // Esperar a que se complete la escritura del documento
    stream.on("finish", () => {
      console.log(`PDF generado correctamente: ${pdfPath}`);

      // Leer el PDF generado
      const pdfContent = fs.readFileSync(pdfPath);

      // Eliminar el archivo temporal
      fs.unlinkSync(pdfPath);

      // Configurar encabezados para descarga
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="reporte_${Date.now()}.pdf"`
      );

      // Enviar el PDF
      res.send(pdfContent);
    });
  } catch (error) {
    console.error("Error general generando PDF:", error);

    // Intentar eliminar el archivo si ocurrió un error
    try {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    } catch (unlinkError) {
      console.error(
        "Error al eliminar archivo en manejo de errores:",
        unlinkError
      );
    }

    res.status(500).json({
      success: false,
      message: "Error al generar PDF",
    });
  }
});

const authRoutes = require("./routes/authRoutes");

// Middleware
app.use(cors());
app.use(express.json());

// Configurar servicio de archivos estáticos para imágenes
app.use("/img", express.static(path.join(__dirname, "../frontend/public/img")));

// Ruta principal
app.get("/", (req, res) => {
  res.json({ message: "API de SIENS funcionando correctamente" });
});

// Ruta de prueba para la BD
app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM tcanio LIMIT 5");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error en test de BD:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para universidades
app.get("/api/universidades", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM tcuniversidad WHERE bActivo = 1"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener universidades:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Endpoint para obtener datos de reporte por universidad
app.get("/api/reportes/universidad/:idUniversidad", async (req, res) => {
  try {
    const { idUniversidad } = req.params;
    const anios = req.query.anios
      ? Array.isArray(req.query.anios)
        ? req.query.anios
        : [req.query.anios]
      : [];
    const semanas = req.query.semanas || 10;

    console.log(
      `Obteniendo reporte para universidad ${idUniversidad}, años:`,
      anios,
      "semanas:",
      semanas
    );

    // Consulta para las fichas de esta universidad
    const [fichas] = await db.query(
      `SELECT 
      f.iIdFicha, f.iIdUniversidad, f.iIdCarrera, f.iIdBachillerato,
      f.iIdAnio, a.cAnio as anio, 
      f.iIdSemana, s.iNumeroSemana as semana,
      f.iHombre, f.iMujer, f.iCantidad 
    FROM 
      tdficha f
      JOIN tcanio a ON f.iIdAnio = a.iIdAnio
      JOIN tcsemana s ON f.iIdSemana = s.iIdSemana
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
      acumulado: [],
    };

    // Mapa para rastrear acumulados por año
    const acumuladosPorAnio = {};

    // Procesar filas de resultados
    fichas.forEach((ficha) => {
      const anioNum = parseInt(ficha.anio);

      // Datos regulares
      reporteData.regular.push({
        semana: ficha.semana,
        anio: anioNum,
        cantidad: ficha.iCantidad,
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
        acumulado: acumuladosPorAnio[anioNum],
      });
    });

    res.json(reporteData);
  } catch (error) {
    console.error(
      `Error al obtener reporte para universidad ${req.params.idUniversidad}:`,
      error
    );
    res.status(500).json({ message: "Error interno del servidor" });
  }
});


// Endpoint para obtener datos de todas las universidades
app.get("/api/reportes/todas", async (req, res) => {
  try {
    const anios = req.query.anios
      ? Array.isArray(req.query.anios)
        ? req.query.anios
        : [req.query.anios]
      : [];
    const semanas = req.query.semanas || 10;

    console.log(
      `Obteniendo reporte para todas las universidades, años:`,
      anios,
      "semanas:",
      semanas
    );

    // Primero obtenemos todas las universidades activas
    const [universidades] = await db.query(
      "SELECT iIdUniversidad, cNombreCorto FROM tcuniversidad WHERE bActivo = 1"
    );

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
        tdficha f
        JOIN tcanio a ON f.iIdAnio = a.iIdAnio
        JOIN tcsemana s ON f.iIdSemana = s.iIdSemana
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
        acumulado: [],
      };

      // Mapa para rastrear acumulados por año
      const acumuladosPorAnio = {};

      // Procesar filas de resultados
      fichas.forEach((ficha) => {
        const anioNum = parseInt(ficha.anio);

        // Datos regulares
        universidadData.regular.push({
          semana: ficha.semana,
          anio: anioNum,
          cantidad: ficha.iCantidad,
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
          acumulado: acumuladosPorAnio[anioNum],
        });
      });

      // Guardar resultados de esta universidad
      resultados[nombreCorto] = universidadData;
    }

    res.json(resultados);
  } catch (error) {
    console.error(
      `Error al obtener reporte para todas las universidades:`,
      error
    );
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.use("/api/auth", authRoutes);

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error("Error no capturado:", err);
  res.status(500).json({
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Exportar la app
module.exports = app;

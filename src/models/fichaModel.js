// src/models/fichaModel.js
const db = require('../config/db');

const fichaModel = {
  findByUniversidadAnioSemana: async (universidadId, anioId, semanaId) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM tdFicha 
         WHERE iIdUniversidad = ? AND iIdAnio = ? AND iIdSemana = ?`,
        [universidadId, anioId, semanaId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Obtener datos para reportes por universidad
  getReporteByUniversidad: async (universidadId, anios, semanas) => {
    try {
      // Convertir anios a formato de consulta IN()
      const aniosStr = anios.map(() => '?').join(',');
      
      // Consulta para obtener datos por semana y año
      const [rows] = await db.query(
        `SELECT 
           f.iIdAnio,
           a.cAnio as anio,
           f.iIdSemana,
           s.iNumeroSemana as semana,
           SUM(f.iCantidad) as cantidad
         FROM 
           tdFicha f
           JOIN tcAnio a ON f.iIdAnio = a.iIdAnio
           JOIN tcSemana s ON f.iIdSemana = s.iIdSemana
         WHERE 
           f.iIdUniversidad = ?
           AND f.iIdAnio IN (${aniosStr})
           AND s.iNumeroSemana <= ?
         GROUP BY 
           f.iIdAnio, f.iIdSemana
         ORDER BY 
           a.cAnio, s.iNumeroSemana`,
        [universidadId, ...anios, semanas]
      );
      
      // Procesar datos para crear estructura de reporte
      const reporteData = {
        regular: [],
        acumulado: []
      };
      
      // Mapa para rastrear acumulados por año
      const acumuladosPorAnio = {};
      
      // Inicializar acumulados
      anios.forEach(anio => {
        acumuladosPorAnio[anio] = 0;
      });
      
      // Procesar filas de resultados
      rows.forEach(row => {
        const anioNum = parseInt(row.anio);
        
        // Datos regulares
        reporteData.regular.push({
          semana: row.semana,
          anio: anioNum,
          cantidad: row.cantidad
        });
        
        // Calcular acumulado
        acumuladosPorAnio[anioNum] += row.cantidad;
        
        // Datos acumulados
        reporteData.acumulado.push({
          semana: row.semana,
          anio: anioNum,
          cantidad: row.cantidad,
          acumulado: acumuladosPorAnio[anioNum]
        });
      });
      
      return reporteData;
    } catch (error) {
      throw error;
    }
  },
  
  getReporteTodasUniversidades: async (anios, semanas) => {
    try {
      // Obtener todas las universidades activas
      const [universidades] = await db.query(
        'SELECT iIdUniversidad, cNombreCorto FROM tcUniversidad WHERE bActivo = 1'
      );
      
      // Objeto para almacenar resultados por universidad
      const resultados = {};
      
      // Para cada universidad, obtener sus datos
      for (const universidad of universidades) {
        const universidadId = universidad.iIdUniversidad;
        const nombreCorto = universidad.cNombreCorto;
        
        // Para cada año solicitado, consultar los datos
        const datosUniversidad = {
          regular: [],
          acumulado: []
        };
        
        for (const anio of anios) {
          // Consulta para obtener datos por semana
          const [filas] = await db.query(
            `SELECT 
               s.iNumeroSemana as semana,
               SUM(f.iCantidad) as cantidad
             FROM 
               tdFicha f
               JOIN tcSemana s ON f.iIdSemana = s.iIdSemana
               JOIN tcAnio a ON s.iIdAnio = a.iIdAnio
             WHERE 
               f.iIdUniversidad = ?
               AND a.cAnio = ?
               AND s.iNumeroSemana <= ?
             GROUP BY 
               s.iNumeroSemana
             ORDER BY 
               s.iNumeroSemana`,
            [universidadId, anio, semanas]
          );
          
          // Procesar resultados para formato consistente
          for (let i = 1; i <= semanas; i++) {
            // Buscar si existe dato para esta semana
            const datoSemana = filas.find(fila => fila.semana === i);
            
            // Dato regular - con cantidad 0 si no hay datos
            datosUniversidad.regular.push({
              semana: i,
              anio: parseInt(anio),
              cantidad: datoSemana ? parseInt(datoSemana.cantidad) : 0
            });
          }
          
          // Calcular acumulados manualmente
          let acumulado = 0;
          for (let i = 0; i < datosUniversidad.regular.length; i++) {
            const dato = datosUniversidad.regular[i];
            if (dato.anio === parseInt(anio)) {
              acumulado += dato.cantidad;
              datosUniversidad.acumulado.push({
                semana: dato.semana,
                anio: dato.anio,
                cantidad: dato.cantidad,
                acumulado: acumulado
              });
            }
          }
        }
        
        // Agregar al resultado
        resultados[nombreCorto] = datosUniversidad;
      }
      
      return resultados;
    } catch (error) {
      console.error('Error en getReporteTodasUniversidades:', error);
      throw error;
    }
  }
};

module.exports = fichaModel;
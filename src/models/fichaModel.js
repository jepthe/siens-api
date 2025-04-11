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
        
        console.log(`Procesando universidad: ${nombreCorto} (ID: ${universidadId})`);
        
        // Consulta OPTIMIZADA para obtener la suma total de inscripciones por semana y año
        const aniosStr = anios.map(() => '?').join(',');
        
        // Esta consulta suma TODAS las inscripciones para cada combinación de semana y año
        const [sumaPorSemana] = await db.query(
          `SELECT 
             a.cAnio as anio,
             s.iNumeroSemana as semana,
             SUM(f.iCantidad) as total_cantidad
           FROM 
             tdFicha f
             JOIN tcSemana s ON f.iIdSemana = s.iIdSemana
             JOIN tcAnio a ON s.iIdAnio = a.iIdAnio
           WHERE 
             f.iIdUniversidad = ?
             AND a.cAnio IN (${aniosStr})
             AND s.iNumeroSemana <= ?
           GROUP BY 
             a.cAnio, s.iNumeroSemana
           ORDER BY 
             a.cAnio, s.iNumeroSemana`,
          [universidadId, ...anios, semanas]
        );
        
        console.log(`Encontrados ${sumaPorSemana.length} registros sumados para ${nombreCorto}`);
        
        // Estructura para organizar los datos
        const datosUniversidad = {
          regular: [],
          acumulado: []
        };
        
        // Procesar los resultados para cada año y semana
        for (const anio of anios) {
          let acumulado = 0;
          
          for (let numSemana = 1; numSemana <= semanas; numSemana++) {
            // Buscar si hay datos para esta semana y año
            const datoSemana = sumaPorSemana.find(
              row => parseInt(row.anio) === parseInt(anio) && row.semana === numSemana
            );
            
            // Cantidad para esta semana (o 0 si no hay datos)
            const cantidad = datoSemana ? parseInt(datoSemana.total_cantidad) : 0;
            
            // Añadir a datos regulares
            datosUniversidad.regular.push({
              semana: numSemana,
              anio: parseInt(anio),
              cantidad: cantidad
            });
            
            // Actualizar acumulado
            acumulado += cantidad;
            
            // Añadir a datos acumulados
            datosUniversidad.acumulado.push({
              semana: numSemana,
              anio: parseInt(anio),
              cantidad: cantidad,
              acumulado: acumulado
            });
          }
        }
        
        // Almacenar los datos de esta universidad
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
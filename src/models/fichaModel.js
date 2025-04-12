// src/models/fichaModel.js
const db = require('../config/db');

const fichaModel = {
  findByUniversidadAnioSemana: async (universidadId, anioId, semanaId) => {
    try {
      const [rows] = await db.query(
        `SELECT * FROM tdficha 
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
           tdficha f
           JOIN tcanio a ON f.iIdAnio = a.iIdAnio
           JOIN tcsemana s ON f.iIdSemana = s.iIdSemana
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
  
  // En fichaModel.js
getReporteTodasUniversidades: async (anios, semanas) => {
  try {
    // Obtener todas las universidades activas
    const [universidades] = await db.query(
      'SELECT iIdUniversidad, cNombreCorto FROM tcuniversidad WHERE bActivo = 1'
    );
    
    const resultados = {};
    
    for (const universidad of universidades) {
      const universidadId = universidad.iIdUniversidad;
      const nombreCorto = universidad.cNombreCorto;
      
      console.log(`Procesando universidad: ${nombreCorto} (ID: ${universidadId})`);
      
      const datosUniversidad = {
        regular: [],
        acumulado: []
      };
      
      // Primero obtenemos todas las sumas de una sola vez con una consulta eficiente
      const aniosNumericos = anios.map(a => parseInt(a, 10));
      
      // Esta consulta suma todos los iCantidad para cada combinación única de año y semana
      const query = `
        SELECT 
          a.cAnio as anio,
          s.iNumeroSemana as semana,
          SUM(f.iCantidad) as suma_cantidad
        FROM 
          tdficha f
          JOIN tcsemana s ON f.iIdSemana = s.iIdSemana
          JOIN tcanio a ON s.iIdAnio = a.iIdAnio
        WHERE 
          f.iIdUniversidad = ?
          AND a.cAnio IN (${anios.map(() => '?').join(',')})
          AND s.iNumeroSemana <= ?
        GROUP BY 
          a.cAnio, s.iNumeroSemana
        ORDER BY 
          a.cAnio, s.iNumeroSemana
      `;
      
      const [sumasPorSemana] = await db.query(
        query, 
        [universidadId, ...aniosNumericos, semanas]
      );
      
      console.log(`Se encontraron ${sumasPorSemana.length} sumatorias para universidad ${nombreCorto}`);
      console.log(sumasPorSemana); // Muestra las sumas para depuración
      
      // Para cada año solicitado
      for (const anio of aniosNumericos) {
        // Inicializar acumulado por año
        let acumulado = 0;
        
        // Para cada semana del 1 al máximo seleccionado
        for (let numSemana = 1; numSemana <= semanas; numSemana++) {
          // Buscar la suma para esta universidad, año y número de semana
          const sumaPorSemana = sumasPorSemana.find(
            row => parseInt(row.anio, 10) === anio && row.semana === numSemana
          );
          
          // Cantidad sumada para esta semana (o 0 si no hay datos)
          const cantidad = sumaPorSemana && sumaPorSemana.suma_cantidad 
            ? parseInt(sumaPorSemana.suma_cantidad, 10) 
            : 0;
          
          console.log(`[${nombreCorto}] Año ${anio}, Semana ${numSemana}: Cantidad ${cantidad}`);
          
          // Añadir a datos regulares
          datosUniversidad.regular.push({
            semana: numSemana,
            anio: anio,
            cantidad: cantidad
          });
          
          // Actualizar acumulado
          acumulado += cantidad;
          
          // Añadir a datos acumulados
          datosUniversidad.acumulado.push({
            semana: numSemana,
            anio: anio,
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
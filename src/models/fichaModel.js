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
      
      // Consulta modificada para filtrar por iNumeroSemana en lugar de iIdSemana
      const [rows] = await db.query(
        `SELECT 
           f.iIdAnio,
           a.cAnio as anio,
           s.iNumeroSemana as semana,  -- Usamos iNumeroSemana, no iIdSemana
           SUM(f.iCantidad) as cantidad
         FROM 
           tdFicha f
           JOIN tcAnio a ON f.iIdAnio = a.iIdAnio
           JOIN tcSemana s ON f.iIdSemana = s.iIdSemana
         WHERE 
           f.iIdUniversidad = ?
           AND f.iIdAnio IN (${aniosStr})
           AND s.iNumeroSemana <= ?  -- Filtramos por iNumeroSemana
         GROUP BY 
           f.iIdAnio, s.iNumeroSemana  -- Agrupamos por iNumeroSemana
         ORDER BY 
           a.cAnio, s.iNumeroSemana`,
        [universidadId, ...anios, semanas]
      );
      
      // Resto del código para procesar los resultados...
    } catch (error) {
      throw error;
    }
  },
  
  
  getReporteTodasUniversidades: async (anios, semanas) => {
    try {
      console.log('getReporteTodasUniversidades - Parámetros:', { anios, semanas });
      
      // Obtener todas las universidades activas
      const [universidades] = await db.query(
        'SELECT iIdUniversidad, cNombreCorto FROM tcUniversidad WHERE bActivo = 1'
      );
      
      console.log(`Encontradas ${universidades.length} universidades activas`);
      
      // Objeto para almacenar resultados por universidad
      const resultados = {};
      
      // Para cada universidad, obtener sus datos
      for (const universidad of universidades) {
        const universidadId = universidad.iIdUniversidad;
        const nombreCorto = universidad.cNombreCorto;
        
        console.log(`Procesando universidad: ${nombreCorto} (ID: ${universidadId})`);
        
        // Consulta para obtener datos por semana y año para esta universidad
        // Nota: No filtramos por año en la consulta SQL para asegurarnos de obtener datos
        const [rows] = await db.query(
          `SELECT 
             f.iIdFicha, f.iIdUniversidad, 
             f.iIdAnio, a.cAnio as anio, 
             s.iNumeroSemana as semana,  -- Usamos iNumeroSemana
             f.iCantidad 
           FROM 
             tdFicha f
             JOIN tcAnio a ON f.iIdAnio = a.iIdAnio
             JOIN tcSemana s ON f.iIdSemana = s.iIdSemana
           WHERE 
             f.iIdUniversidad = ?
             AND s.iNumeroSemana <= ?  -- Filtramos por iNumeroSemana
           ORDER BY 
             a.cAnio, s.iNumeroSemana`,
          [universidadId, semanas]
        );
        
        console.log(`Encontrados ${rows.length} registros para ${nombreCorto}`);
        
        // Filtrar por los años solicitados (hacemos esto en memoria para depurar mejor)
        const filteredRows = rows.filter(row => {
          const anioNum = parseInt(row.anio);
          return anios.includes(anioNum);
        });
        
        console.log(`Después de filtrar por años (${anios.join(', ')}): ${filteredRows.length} registros`);
        
        // Procesar datos para esta universidad
        const universidadData = {
          regular: [],
          acumulado: []
        };
        
        // Mapa para rastrear acumulados por año
        const acumuladosPorAnio = {};
        
        // Inicializar acumulados para todos los años solicitados
        anios.forEach(anio => {
          acumuladosPorAnio[anio] = 0;
        });
        
        // Procesar filas filtradas
        filteredRows.forEach(row => {
          const anioNum = parseInt(row.anio);
          const semanaNum = parseInt(row.semana);
          const cantidad = parseInt(row.iCantidad);
          
          // Verificar que todos los valores sean válidos
          if (isNaN(anioNum) || isNaN(semanaNum) || isNaN(cantidad)) {
            console.log(`Advertencia: Datos inválidos encontrados: ${JSON.stringify(row)}`);
            return; // Saltar esta fila
          }
          
          // Datos regulares - asegurarnos de que cada propiedad es del tipo correcto
          universidadData.regular.push({
            semana: semanaNum,
            anio: anioNum,
            cantidad: cantidad
          });
          
          // Calcular acumulado
          acumuladosPorAnio[anioNum] += cantidad;
          
          // Datos acumulados
          universidadData.acumulado.push({
            semana: semanaNum,
            anio: anioNum,
            cantidad: cantidad,
            acumulado: acumuladosPorAnio[anioNum]
          });
        });
        
        // Si no hay datos, crear datos de ejemplo para las semanas solicitadas
        if (universidadData.regular.length === 0) {
          console.log(`No se encontraron datos para ${nombreCorto}, generando datos de ejemplo para pruebas`);
          
          anios.forEach(anio => {
            acumuladosPorAnio[anio] = 0;
            
            for (let semana = 1; semana <= semanas; semana++) {
              // Generar un valor aleatorio para pruebas
              const cantidad = 0; // Para producción mejor poner 0 en lugar de un valor aleatorio
              
              // Datos regulares
              universidadData.regular.push({
                semana: semana,
                anio: anio,
                cantidad: cantidad
              });
              
              // Calcular acumulado
              acumuladosPorAnio[anio] += cantidad;
              
              // Datos acumulados
              universidadData.acumulado.push({
                semana: semana,
                anio: anio,
                cantidad: cantidad,
                acumulado: acumuladosPorAnio[anio]
              });
            }
          });
        }
        
        console.log(`Datos procesados para ${nombreCorto}: ${universidadData.regular.length} registros regulares, ${universidadData.acumulado.length} acumulados`);
        
        // Guardar resultados de esta universidad
        resultados[nombreCorto] = universidadData;
      }
      
      return resultados;
    } catch (error) {
      console.error('Error en getReporteTodasUniversidades:', error);
      throw error;
    }
  }
};

module.exports = fichaModel;
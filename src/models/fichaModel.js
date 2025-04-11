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
      
      const resultados = {};
      
      for (const universidad of universidades) {
        const universidadId = universidad.iIdUniversidad;
        const nombreCorto = universidad.cNombreCorto;
        
        console.log(`Procesando universidad: ${nombreCorto} (ID: ${universidadId})`);
        
        const datosUniversidad = {
          regular: [],
          acumulado: []
        };
        
        // Para cada año solicitado
        for (const anio of anios) {
          console.log(`Procesando año: ${anio}`);
          
          // Primero, obtener los iIdSemana correspondientes a las semanas de este año
          const [idsSemanas] = await db.query(
            `SELECT iIdSemana, iNumeroSemana 
             FROM tcSemana 
             WHERE iIdAnio = (SELECT iIdAnio FROM tcAnio WHERE cAnio = ?) 
               AND iNumeroSemana <= ?
             ORDER BY iNumeroSemana`,
            [anio, semanas]
          );
          
          console.log(`Encontrados ${idsSemanas.length} IDs de semanas para el año ${anio}`);
          
          if (idsSemanas.length === 0) {
            console.log(`No se encontraron semanas para el año ${anio}`);
            // Generar semanas vacías
            for (let s = 1; s <= semanas; s++) {
              datosUniversidad.regular.push({
                semana: s,
                anio: parseInt(anio),
                cantidad: 0
              });
            }
            continue;
          }
          
          // Para cada semana del 1 al máximo seleccionado
          let acumulado = 0;
          for (let numSemana = 1; numSemana <= semanas; numSemana++) {
            // Buscar el ID de semana correspondiente
            const semaInfo = idsSemanas.find(s => s.iNumeroSemana === numSemana);
            
            if (!semaInfo) {
              console.log(`No se encontró iIdSemana para semana ${numSemana} año ${anio}`);
              // Si no hay ID para esta semana, añadir con cantidad 0
              datosUniversidad.regular.push({
                semana: numSemana,
                anio: parseInt(anio),
                cantidad: 0
              });
              
              datosUniversidad.acumulado.push({
                semana: numSemana,
                anio: parseInt(anio),
                cantidad: 0,
                acumulado: acumulado
              });
              
              continue;
            }
            
            // Obtener la suma de inscripciones para esta universidad, semana y año
            const [sumaInscripciones] = await db.query(
              `SELECT SUM(iCantidad) AS total
               FROM tdFicha
               WHERE iIdUniversidad = ?
                 AND iIdSemana = ?`,
              [universidadId, semaInfo.iIdSemana]
            );
            
            // Cantidad para esta semana (o 0 si no hay datos)
            const cantidad = sumaInscripciones[0] && sumaInscripciones[0].total 
              ? parseInt(sumaInscripciones[0].total) 
              : 0;
            
            console.log(`Universidad ${nombreCorto}, Año ${anio}, Semana ${numSemana}, iIdSemana ${semaInfo.iIdSemana}, Cantidad: ${cantidad}`);
            
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
// src/services/openaiService.js
// Responsabilidad: Comunicarse con la API de OpenAI para interpretar el mensaje del cliente.
// Lógica (Simplificada para V1 con formato 'Cobra a ... por ...'):
//   - Recibir messageText.
//   - Llamar a la API de OpenAI con un prompt específico.
//   - Parsear la respuesta de OpenAI para extraer cliente, monto, concepto.
//   - Devolver un objeto con { cliente, monto, concepto } o null si falla.

const OpenAI = require('openai'); // Importar la librería oficial de OpenAI
const logger = require('../utils/logger'); // Importar nuestro logger

// Inicializar el cliente de OpenAI con la clave de API desde las variables de entorno
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Asegúrate de configurar esta variable en Render
});

/**
 * Extrae detalles de pago (cliente, monto, concepto) de un mensaje de texto usando OpenAI.
 * @param {string} messageText - El texto del mensaje recibido.
 * @returns {Promise<Object|null>} - Un objeto con { cliente, monto, concepto } o null si falla.
 */
const extractPaymentDetails = async (messageText) => {
  logger.info(`[OPENAI SERVICE] Intentando extraer detalles de pago con OpenAI para: "${messageText}"`);

  try {
    // Definir el prompt para la API de OpenAI
    // Este prompt le indica a GPT qué información debe extraer y en qué formato
    const prompt = `
      Por favor, extrae la siguiente información del mensaje de texto proporcionado.
      El mensaje seguirá el formato: "Cobra a (Nombre Cliente Final) (Cantidad) por (Descripción)".
      Devuelve un objeto JSON con las siguientes claves: "cliente", "monto", "concepto".
      Asegúrate de que el monto sea un número (puede ser entero o decimal).
      Si alguna parte no se puede identificar claramente, devuélvela como null.

      Mensaje: "${messageText}"
    `;

    // Llamar a la API de OpenAI para completar el chat
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo', // Puedes cambiar el modelo si lo deseas (e.g., 'gpt-4')
      temperature: 0.3, // Baja temperatura para respuestas más deterministas
      max_tokens: 150, // Límite de tokens para la respuesta
    });

    // Obtener la respuesta del modelo
    const rawResponse = chatCompletion.choices[0]?.message?.content?.trim();

    if (!rawResponse) {
      logger.warn('[OPENAI SERVICE] La API de OpenAI no devolvió contenido.', { messageText });
      return null;
    }

    logger.debug('[OPENAI SERVICE] Respuesta cruda de OpenAI recibida.', { rawResponse });

    // Intentar parsear la respuesta como JSON
    let extractedData;
    try {
      extractedData = JSON.parse(rawResponse);
    } catch (parseError) {
      logger.error('[OPENAI SERVICE] Error al parsear la respuesta JSON de OpenAI.', {
        rawResponse,
        error: parseError.message
      });
      // Si falla el parseo, podrías intentar una extracción básica con expresiones regulares
      // como fallback, pero para V1, asumiremos que OpenAI devuelve JSON limpio.
      return null;
    }

    // Validar y normalizar los datos extraídos
    const validatedData = {
      cliente: typeof extractedData.cliente === 'string' ? extractedData.cliente.trim() : null,
      monto: parseAmount(extractedData.monto), // Asegura que sea un número o null
      concepto: typeof extractedData.concepto === 'string' ? extractedData.concepto.trim() : null,
    };

    // Verificar que al menos el monto y el concepto tengan valores razonables
    if (validatedData.monto === null || validatedData.concepto === null) {
        logger.warn('[OPENAI SERVICE] Datos extraídos insuficientes o inválidos.', { validatedData });
        return null;
    }

    logger.info('[OPENAI SERVICE] Datos de pago extraídos exitosamente.', { extractedData: validatedData });
    return validatedData;

  } catch (error) {
    logger.error('[OPENAI SERVICE] Error al extraer detalles de pago con OpenAI:', {
      message: error.message,
      stack: error.stack,
      inputMessage: messageText.substring(0, 100) + '...' // Loguear solo parte del mensaje de entrada por seguridad
    });
    // Relanzar el error para que el módulo superior (commandExtractor) lo maneje
    throw error; // Opcional: Puedes devolver null en lugar de lanzar el error
  }
};

/**
 * Función auxiliar para parsear el monto a número.
 * @param {*} amount - El valor potencial del monto (puede ser string o number).
 * @returns {number|null} - El monto como número o null si no se puede parsear.
 */
function parseAmount(amount) {
  if (typeof amount === 'number') {
    return amount;
  }
  if (typeof amount === 'string') {
    // Remover signos de moneda y espacios innecesarios
    const cleanedAmount = amount.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(cleanedAmount);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

module.exports = {
  extractPaymentDetails // Exportamos la función principal
};
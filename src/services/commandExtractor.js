// src/services/commandExtractor.js
// Responsabilidad: Interpretar el texto del mensaje para extraer los datos necesarios (cliente final, monto, concepto) usando OpenAI.
// Lógica (Actualizada para V1 con OpenAI):
//   - Recibir messageText.
//   - Llamar al servicio de OpenAI para interpretar el mensaje con el formato "Cobra a ... por ...".
//   - Devolver un objeto con { amount, concept, finalCustomerName } o null si falla.

const logger = require('../utils/logger'); // Importamos el logger
// Importar el servicio de OpenAI
const openaiService = require('./openaiService'); // Asegúrate de que openaiService.js exista y esté correctamente implementado en V1

/**
 * Extrae datos de pago del mensaje de texto usando OpenAI.
 * @param {string} messageText - El texto del mensaje recibido.
 * @returns {Object|null} - Un objeto con { amount, concept, finalCustomerName } o null si falla.
 */
const extractPaymentData = async (messageText) => {
    logger.debug(`[COMMAND EXTRACTOR] Intentando extraer datos con OpenAI de: "${messageText}"`);

    try {
        // Llamar al servicio de OpenAI para extraer los datos
        // Se asume que openaiService.extractPaymentDetails devuelve un objeto con cliente, monto, concepto
        const extractedData = await openaiService.extractPaymentDetails(messageText);

        if (extractedData) {
            logger.info(`[COMMAND EXTRACTOR] Datos extraídos exitosamente por OpenAI:`, extractedData);
            // Devolver solo los campos necesarios, sin el email
            return {
                amount: extractedData.monto,
                concept: extractedData.concepto,
                finalCustomerName: extractedData.cliente
                // No se devuelve email
            };
        } else {
            logger.warn(`[COMMAND EXTRACTOR] OpenAI no devolvió datos válidos para el mensaje: "${messageText}"`);
            return null;
        }
    } catch (error) {
        logger.error(`[COMMAND EXTRACTOR] Error al extraer datos con OpenAI para el mensaje: "${messageText}"`, error.message);
        // Opcional: Registrar el stack del error para diagnóstico más detallado
        // logger.error('Stack:', error.stack);
        return null;
    }
};

module.exports = {
    extractPaymentData // Exportamos la función principal
};
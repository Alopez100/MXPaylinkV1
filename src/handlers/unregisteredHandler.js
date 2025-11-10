// src/handlers/unregisteredHandler.js
// Responsabilidad: Gestionar la interacción con un número desconocido (no registrado).
// Entrada: from, messageText.
// Lógica:
//   - Envia un mensaje estándar indicando que no está registrado y cómo proceder.
// Siguiente Paso: Finaliza la interacción desde este handler.

const logger = require('../utils/logger'); // Importamos el logger
// const whatsappService = require('../services/whatsappService'); // Importaremos esto cuando esté disponible

// Mensaje estándar para clientes no registrados
const NOT_REGISTERED_MESSAGE = "Hola, este número no está registrado en el sistema MXPaylink. " +
                               "Por favor, contacta al administrador para darte de alta y poder usar el servicio.";

/**
 * Maneja los mensajes entrantes de un cliente no registrado.
 * @param {string} from - El número de teléfono del remitente.
 * @param {string} messageText - El texto del mensaje recibido.
 */
const handle = async (from, messageText) => {
    logger.info(`[UNREGISTERED HANDLER] Cliente NO registrado intentó interactuar. Teléfono: ${from}. Mensaje: "${messageText}"`);

    // Enviar mensaje de notificación al cliente
    // await whatsappService.sendMessage(from, NOT_REGISTERED_MESSAGE);
    // Por ahora, simulamos el envío
    console.log(`[SIMULACIÓN WHATSAPP] Enviando a ${from}: ${NOT_REGISTERED_MESSAGE}`);

    logger.debug(`[UNREGISTERED HANDLER] Mensaje enviado a cliente no registrado: ${from}`);
};

module.exports = {
    handle // Exportamos la función principal
};
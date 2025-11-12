// src/processors/messageProcessor.js
// Responsabilidad: Procesar el mensaje recibido, determinar si el cliente es registrado o no y llamar al manejador correspondiente.
// Lógica:
//   - Recibe el número de teléfono 'from' y el texto del mensaje 'messageText'.
//   - Normaliza el número de teléfono.
//   - Busca al cliente en la base de datos usando el número normalizado.
//   - Si lo encuentra y está activo, llama a registeredHandler.
//   - Si no lo encuentra o no está activo, llama a unregisteredHandler.

// --- CORREGIDO: Rutas relativas a handlers/ ---
const { findCustomerByPhoneNumber } = require('../services/customerDB'); // CORRECTO: Ruta relativa a services/customerDB.js
// --- CORREGIDO: Cambiado el nombre de la función importada a 'handlePaymentRequest' (nombre correcto con el que se exporta en V1 registeredHandler.js) ---
const { handlePaymentRequest } = require('../handlers/registeredHandler'); // CORREGIDO: Ruta relativa a handlers/registeredHandler.js
const { handleUnregisteredCustomer } = require('../handlers/unregisteredHandler'); // CORREGIDO: Ruta relativa a handlers/unregisteredHandler.js
const logger = require('../utils/logger'); // Importamos el logger
const { normalizePhoneNumber } = require('../utils/phoneNormalizer'); // Importamos la función de normalización

/**
 * Procesa el mensaje entrante.
 * @param {string} from - El número de teléfono del remitente.
 * @param {string} messageText - El texto del mensaje recibido.
 */
const processMessage = async (from, messageText) => {
  logger.info(`[MESSAGE PROCESSOR] Iniciando procesamiento para teléfono: ${from}`);

  // 1. Normalizar el número de teléfono
  const normalizedFrom = normalizePhoneNumber(from);
  if (!normalizedFrom) {
    logger.error(`[MESSAGE PROCESSOR] Número de teléfono inválido recibido y no se pudo normalizar: ${from}`);
    // Opcional: Enviar un mensaje de error al cliente
    return;
  }

  logger.debug(`[MESSAGE PROCESSOR] Número original: ${from}, Número normalizado: ${normalizedFrom}`);

  try {
    // 2. Buscar al cliente en la base de datos usando el número normalizado
    const customer = await findCustomerByPhoneNumber(normalizedFrom); // Se usa el número normalizado

    if (customer && customer.service_status === 'activo') {
      logger.info(`[MESSAGE PROCESSOR] Cliente encontrado y activo: ${normalizedFrom}. ID: ${customer.id}.`);
      // 3. Si el cliente existe y está activo, llamar al manejador de clientes registrados
      // --- CORREGIDO: Llamar a la función correcta 'handlePaymentRequest' (nombre correcto con el que se exporta en V1 registeredHandler.js) ---
      await handlePaymentRequest(customer, messageText, normalizedFrom); // Pasamos el número normalizado
    } else {
      logger.info(`[MESSAGE PROCESSOR] Cliente NO encontrado o no está activo para teléfono: ${normalizedFrom}.`);
      // 4. Si no se encuentra o no está activo, llamar al manejador de clientes no registrados
      await handleUnregisteredCustomer(messageText, normalizedFrom); // Pasamos el número normalizado
    }
  } catch (error) {
    // Captura errores generales durante la búsqueda o procesamiento
    logger.error(`[MESSAGE PROCESSOR] Error al procesar el mensaje para ${normalizedFrom}:`, error.message);
    // Opcional: Enviar un mensaje genérico de error al cliente
    // await whatsappService.sendMessage(normalizedFrom, "Lo siento, hubo un error al procesar tu solicitud.");
  }
};

module.exports = {
  processMessage // Exportamos la función principal
};
// src/processors/messageProcessor.js
// Responsabilidad: Determinar si 'from' está registrado.
// Entrada: from, messageText.
// Lógica:
//   - Consulta CustomerDB (un nuevo módulo simple para interactuar con la base de datos de clientes) por 'from'.
//   - Si customer existe -> Llama a RegisteredHandler.
//   - Si customer no existe -> Llama a UnregisteredHandler.
// Siguiente Paso: Llama al handler correspondiente.

const logger = require('../utils/logger'); // Importamos el logger
const customerDB = require('../services/customerDB'); // Importamos el módulo de acceso a la DB de clientes
const unregisteredHandler = require('../handlers/unregisteredHandler'); // Importamos el handler para no registrados
const registeredHandler = require('../handlers/registeredHandler'); // Importamos el handler para registrados

// Función principal para procesar el mensaje
const processMessage = async (from, messageText) => {
    logger.info(`[MESSAGE PROCESSOR] Iniciando procesamiento para teléfono: ${from}`);

    try {
        // Buscar el cliente en la base de datos usando la función del módulo customerDB
        const customer = await customerDB.findCustomerByPhoneNumber(from);

        if (customer) {
            logger.info(`[MESSAGE PROCESSOR] Cliente encontrado en DB: ${customer.phone}. ID: ${customer.id}`);
            // Si el cliente existe, lo manejamos como un cliente registrado
            await registeredHandler.handle(from, messageText, customer);
        } else {
            logger.info(`[MESSAGE PROCESSOR] Cliente NO encontrado en DB para teléfono: ${from}.`);
            // Si el cliente no existe, lo manejamos como un cliente no registrado
            await unregisteredHandler.handle(from, messageText);
        }
    } catch (error) {
        // Captura errores generales durante la búsqueda o procesamiento
        logger.error(`[MESSAGE PROCESSOR] Error al procesar el mensaje para ${from}:`, error.message);
        // Opcional: Enviar un mensaje genérico de error al cliente
        // await whatsappService.sendMessage(from, "Lo siento, hubo un error al procesar tu solicitud.");
    }
};

module.exports = {
    processMessage // Exportamos la función principal
};
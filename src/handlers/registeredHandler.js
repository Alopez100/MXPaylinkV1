// src/handlers/registeredHandler.js
// Responsabilidad: Gestionar la solicitud de pago de un cliente activo.
// Entrada: from, messageText, customer (el objeto cliente ya obtenido).
// Lógica (Simplificada para V1 con solo PayPal):
//   - Verifica Customer.service_status === 'activo'.
//   - Extrae datos (cliente final, monto, concepto) de messageText.
//   - Llama a servicePaymentGenerator.createServicePaymentLinkForCustomer(...) (el link que paga *el cliente final*).
//   - Obtiene el finalPaymentLink.
//   - Envia finalPaymentLink por WhatsApp al cliente final.
// Siguiente Paso: El cliente final paga el link (activa webhook de pago final, fuera del alcance inmediato de V1).

const logger = require('../utils/logger'); // Importamos el logger
const commandExtractor = require('../services/commandExtractor'); // Importamos el extractor de comandos
const servicePaymentGenerator = require('../services/servicePaymentGenerator'); // Importamos el generador de links
// const whatsappService = require('../services/whatsappService'); // Importaremos esto cuando esté disponible

/**
 * Maneja los mensajes entrantes de un cliente registrado y activo.
 * @param {string} from - El número de teléfono del cliente registrado.
 * @param {string} messageText - El texto del mensaje recibido.
 * @param {Object} customer - El objeto cliente ya obtenido de la base de datos.
 */
const handle = async (from, messageText, customer) => {
    logger.info(`[REGISTERED HANDLER] Procesando solicitud de pago para cliente registrado: ${from}. Mensaje: "${messageText}"`);

    // 1. Verificar que el servicio del cliente esté activo
    if (customer.service_status !== 'activo') {
        logger.warn(`[REGISTERED HANDLER] Cliente ${from} tiene el servicio inactivo (${customer.service_status}). No se procesa la solicitud.`);
        // Enviar mensaje de error al cliente
        // await whatsappService.sendMessage(from, "Tu servicio MXPaylink no está activo. Por favor, contacta al administrador.");
        console.log(`[SIMULACIÓN WHATSAPP] Enviando a ${from}: Tu servicio MXPaylink no está activo. Por favor, contacta al administrador.`);
        return;
    }

    logger.debug(`[REGISTERED HANDLER] Cliente ${from} tiene el servicio activo. Procediendo con la extracción de datos.`);

    // 2. Extraer datos (cliente final, monto, concepto) del messageText
    // Usamos el nuevo módulo commandExtractor para esto
    const extractedData = await commandExtractor.extractPaymentData(messageText);

    if (!extractedData) {
        logger.warn(`[REGISTERED HANDLER] No se pudieron extraer datos válidos del mensaje para ${from}. Mensaje: "${messageText}"`);
        // Enviar mensaje de error o formato incorrecto al cliente
        // const errorMessage = "Formato de mensaje incorrecto. Por favor, envía: PAGO [monto] [concepto] [nombre_cliente_final] [email_cliente_final]";
        // await whatsappService.sendMessage(from, errorMessage);
        console.log(`[SIMULACIÓN WHATSAPP] Enviando a ${from}: Formato de mensaje incorrecto. Por favor, envía: PAGO [monto] [concepto] [nombre_cliente_final] [email_cliente_final]`);
        return;
    }

    logger.info(`[REGISTERED HANDLER] Datos extraídos para ${from}:`, extractedData);

    // 3. Llamar al generador de links de pago para el cliente final
    // En V1, asumimos que el cliente registrado solo usa PayPal para generar el link para su cliente final.
    // En el futuro, aquí se podría integrar la lógica de selección de proveedor si se permiten múltiples proveedores para el cliente final.
    try {
        const { amount, concept, finalCustomerName, finalCustomerEmail } = extractedData;

        // Generar el link de pago para el cliente final usando el proveedor PayPal
        // El generador debe usar las credenciales de PayPal del cliente registrado (customer.paypal_creds)
        const finalPaymentLink = await servicePaymentGenerator.createFinalPaymentLinkForCustomer(
            customer.id, // ID del cliente MXPaylink (el que paga el servicio)
            customer.paypal_creds, // Credenciales de PayPal del cliente MXPaylink (simulado aquí)
            amount,
            concept,
            finalCustomerName,
            finalCustomerEmail
        );

        if (finalPaymentLink) {
            logger.info(`[REGISTERED HANDLER] Link de pago generado exitosamente para cliente final ${finalCustomerName} (${finalCustomerEmail}) por ${from}. Link: ${finalPaymentLink}`);
            // 4. Enviar el link final al número de teléfono del cliente final (esto se obtendría del extractedData si se incluye)
            // Por ahora, simulamos el envío al cliente final. En la realidad, podría haber un número de cliente final en extractedData.
            // await whatsappService.sendMessage(finalCustomerPhone, `Hola ${finalCustomerName}, aquí está tu link de pago: ${finalPaymentLink}`);
            console.log(`[SIMULACIÓN WHATSAPP] Enviando a CLIENTE FINAL (${finalCustomerName}): Hola ${finalCustomerName}, aquí está tu link de pago: ${finalPaymentLink}`);

             // Opcional: Enviar confirmación al cliente MXPaylink que generó el link
            // await whatsappService.sendMessage(from, `El link de pago para ${finalCustomerName} ha sido generado y enviado.`);
            console.log(`[SIMULACIÓN WHATSAPP] Enviando a ${from}: El link de pago para ${finalCustomerName} ha sido generado y enviado.`);
        } else {
            logger.error(`[REGISTERED HANDLER] No se pudo generar el link de pago para el cliente final solicitado por ${from}.`);
            // await whatsappService.sendMessage(from, "Lo sentimos, hubo un error al generar el link de pago. Inténtalo de nuevo.");
            console.log(`[SIMULACIÓN WHATSAPP] Enviando a ${from}: Lo sentimos, hubo un error al generar el link de pago. Inténtalo de nuevo.`);
        }

    } catch (error) {
        logger.error(`[REGISTERED HANDLER] Error al generar el link de pago para el cliente final solicitado por ${from}:`, error.message);
        // await whatsappService.sendMessage(from, "Lo sentimos, hubo un error interno al procesar tu solicitud. Inténtalo más tarde.");
        console.log(`[SIMULACIÓN WHATSAPP] Enviando a ${from}: Lo sentimos, hubo un error interno al procesar tu solicitud. Inténtalo más tarde.`);
    }
};

module.exports = {
    handle // Exportamos la función principal
};
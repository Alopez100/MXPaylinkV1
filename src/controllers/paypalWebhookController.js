// C:\Users\MotoTaxi\Documents\MXPaylink\V1\src\controllers\paypalWebhookController.js
// Responsabilidad: Recibir la notificación de PayPal sobre el pago del cliente final.
// Entrada: req.body (webhook de PayPal).
// Lógica (Simplificada para V1):
//   - Verificar evento CAPTURE.COMPLETED (simplificado, sin firma por ahora).
//   - Extrae el order_id del webhook para identificar la transacción.
//   - Llama a paypalWebhookOrchestrator.processEvent(...).
// Siguiente Paso: Actualiza el estado del pago interno o notifica al cliente MXPaylink.

const logger = require('../utils/logger'); // Importamos el logger
const paypalWebhookOrchestrator = require('../orchestrators/paypalWebhookOrchestrator'); // Importamos el orquestador

// NOTA: En una implementación real, es crucial verificar la firma del webhook.
// Por simplicidad en V1, omitiremos temporalmente esta verificación.
// Consulta la documentación de PayPal para implementarla: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature

/**
 * Maneja la solicitud POST entrante del webhook de PayPal.
 * @param {Object} req - El objeto de solicitud de Express.
 * @param {Object} res - El objeto de respuesta de Express.
 */
const handleWebhook = async (req, res) => {
    logger.info('[PAYPAL WEBHOOK CONTROLLER] Recibida solicitud POST de webhook de PayPal.');

    // Extrae el cuerpo de la solicitud
    const { body } = req;

    // Verifica que el cuerpo no esté vacío
    if (!body || Object.keys(body).length === 0) {
        logger.warn('[PAYPAL WEBHOOK CONTROLLER] Solicitud de webhook vacía.');
        return res.status(400).json({ error: 'Webhook body is empty' });
    }

    logger.debug('[PAYPAL WEBHOOK CONTROLLER] Cuerpo del webhook recibido:', body);

    try {
        // Extrae el tipo de evento y el resource del webhook
        const eventType = body.event_type;
        const resource = body.resource;

        if (!eventType) {
            logger.warn('[PAYPAL WEBHOOK CONTROLLER] No se encontró el tipo de evento en el webhook.');
            return res.status(400).json({ error: 'Missing event_type in webhook' });
        }

        logger.info(`[PAYPAL WEBHOOK CONTROLLER] Tipo de evento recibido: ${eventType}`);

        // Filtrar eventos: Solo procesamos PAYMENT.CAPTURE.COMPLETED por ahora
        if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
            logger.info('[PAYPAL WEBHOOK CONTROLLER] Procesando evento PAYMENT.CAPTURE.COMPLETED.');

            // Extrae el ID del pago capturado o del pedido
            // En este tipo de evento, el ID del pago capturado está en resource.id
            // El order_id asociado originalmente puede estar en resource.links o resource.purchase_units[0].reference_id
            const captureId = resource.id;
            const orderId = resource.purchase_units?.[0]?.reference_id; // O puede estar en otro lugar según la creación de la orden

            if (!captureId) {
                logger.error('[PAYPAL WEBHOOK CONTROLLER] No se encontró el capture_id en el webhook PAYMENT.CAPTURE.COMPLETED.');
                return res.status(400).json({ error: 'Missing capture_id in webhook' });
            }

            logger.info(`[PAYPAL WEBHOOK CONTROLLER] Capture ID: ${captureId}, Order ID: ${orderId}`);

            // Llama al orquestador para procesar el evento de captura
            await paypalWebhookOrchestrator.processCaptureCompleted(captureId, orderId, body);

            logger.info(`[PAYPAL WEBHOOK CONTROLLER] Evento PAYMENT.CAPTURE.COMPLETED para capture ${captureId} procesado exitosamente.`);
            // Responder con 200 OK para indicar que el webhook fue recibido correctamente
            res.status(200).json({ message: 'Webhook received and processed successfully' });

        } else {
            // Si el evento no es uno que manejamos, lo registramos y respondemos OK para descartarlo
            logger.info(`[PAYPAL WEBHOOK CONTROLLER] Evento no manejado recibido: ${eventType}. Respondiendo OK para descartar.`);
            res.status(200).json({ message: 'Webhook received, event type not handled' });
        }

    } catch (error) {
        logger.error('[PAYPAL WEBHOOK CONTROLLER] Error al procesar el webhook de PayPal:', error.message);
        // En caso de error, es mejor responder con 500 para que PayPal reintente
        res.status(500).json({ error: 'Internal Server Error processing webhook' });
    }
};

module.exports = {
    handleWebhook // Exportamos la función principal
};
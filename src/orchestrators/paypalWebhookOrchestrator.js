// src/orchestrators/paypalWebhookOrchestrator.js
// Responsabilidad: Procesar el evento de captura completada de PayPal recibido desde el controlador.
// Lógica (Simplificada para V1):
//   - Recibir captureId, orderId, y body del webhook.
//   - (Opcional en V1 simplificado) Actualizar un registro de pago interno si se crea uno.
//   - Notificar al cliente MXPaylink que generó el link que el pago fue completado.
// Siguiente Paso: Finaliza la notificación del evento de pago.

const logger = require('../utils/logger'); // Importamos el logger
// const paymentService = require('../services/paymentService'); // Si se manejan registros de pago internos
// const whatsappService = require('../services/whatsappService'); // Para notificar al cliente MXPaylink

/**
 * Procesa el evento PAYMENT.CAPTURE.COMPLETED recibido del webhook de PayPal.
 * @param {string} captureId - El ID de la captura de pago en PayPal.
 * @param {string} orderId - El ID de la orden original en PayPal (si está disponible).
 * @param {Object} webhookBody - El cuerpo completo del webhook recibido.
 */
const processCaptureCompleted = async (captureId, orderId, webhookBody) => {
    logger.info(`[PAYPAL WEBHOOK ORCHESTRATOR] Procesando evento PAYMENT.CAPTURE.COMPLETED para Capture ID: ${captureId}, Order ID: ${orderId}`);

    // En V1 simplificado, asumimos que el cliente MXPaylink no tiene un registro interno
    // de cada pago generado para su cliente final. Solo recibirá una notificación general.
    // Si se implementara un registro interno (Payment), aquí se buscaría por `orderId`
    // y se actualizaría su estado.

    // 1. Loggear detalles del evento recibido para auditoría/diagnóstico
    logger.info(`[PAYPAL WEBHOOK ORCHESTRATOR] Detalles del evento recibido para Capture ${captureId}:`, {
        amount: webhookBody.resource?.amount?.value,
        currency: webhookBody.resource?.amount?.currency_code,
        // ... otros campos relevantes del webhook
    });

    // 2. (Opcional V1) Intentar identificar al cliente MXPaylink asociado si se almacenó
    // el `customer_id` del cliente MXPaylink en la orden de PayPal como `custom_id` o `invoice_id`.
    // Por ejemplo, si al crear la orden en paypalService.js se incluyó:
    // purchase_units[0].custom_id = customerId; // del cliente MXPaylink
    const mxpaylinkCustomerId = webhookBody.resource?.purchase_units?.[0]?.custom_id; // O `invoice_id` si se usó eso
    // const mxpaylinkCustomerId = null; // <-- Simulación si no se usó custom_id en la orden

    if (mxpaylinkCustomerId) {
        logger.info(`[PAYPAL WEBHOOK ORCHESTRATOR] Cliente MXPaylink asociado encontrado: ${mxpaylinkCustomerId} para Capture ${captureId}.`);
        // Aquí se podría buscar el número de teléfono del cliente MXPaylink en la base de datos
        // usando `customerDB.findCustomerById(mxpaylinkCustomerId)` o una función similar.
        // const customerRecord = await customerDB.findCustomerById(mxpaylinkCustomerId);
        // if (customerRecord && customerRecord.phone) {
        //     const clientPhone = customerRecord.phone;
        //     await whatsappService.sendMessage(clientPhone, `El pago para tu cliente final fue completado exitosamente. ID de captura: ${captureId}`);
        //     logger.info(`[PAYPAL WEBHOOK ORCHESTRATOR] Notificación de pago enviada a cliente MXPaylink ${clientPhone}.`);
        // } else {
        //     logger.warn(`[PAYPAL WEBHOOK ORCHESTRATOR] No se pudo encontrar el número de teléfono del cliente MXPaylink ID: ${mxpaylinkCustomerId}.`);
        // }
        // Por ahora, simulamos la notificación
        console.log(`[SIMULACIÓN WHATSAPP] Enviando a CLIENTE_MX_PAYLINK_ID_${mxpaylinkCustomerId}: El pago para tu cliente final fue completado exitosamente. ID de captura: ${captureId}`);

    } else {
        logger.info(`[PAYPAL WEBHOOK ORCHESTRATOR] No se encontró un ID de cliente MXPaylink asociado en el evento para Capture ${captureId}. No se enviará notificación específica.`);
        // Opcional: Enviar una notificación genérica si es necesario
        // console.log(`[SIMULACIÓN WHATSAPP] Notificación general: Se completó un pago (ID: ${captureId}), pero no se identificó al cliente MXPaylink.`);
    }

    // 3. (Opcional V1) Actualizar un estado interno de pago si se implementa
    // await paymentService.updateInternalPaymentStatus(orderId, captureId, 'paid');

    logger.info(`[PAYPAL WEBHOOK ORCHESTRATOR] Proceso del evento PAYMENT.CAPTURE.COMPLETED para Capture ${captureId} finalizado.`);
};

module.exports = {
    processCaptureCompleted // Exportamos la función principal
};
// src/services/servicePaymentGenerator.js
// Responsabilidad: Generar el link de pago *final* para el cliente final usando el proveedor especificado (en V1, solo PayPal).
// Lógica (Simplificada para V1 con solo PayPal):
//   - Recibir datos del cliente final (monto, concepto, nombre, email), credenciales del cliente MXPaylink.
//   - Llamar a paypalService.createOrder para crear la orden en PayPal.
//   - Devolver la approval_url o null si falla.

const logger = require('../utils/logger'); // Importamos el logger
const paypalService = require('./paypalService'); // Importamos el servicio específico de PayPal

/**
 * Genera un link de pago para un cliente final usando las credenciales del cliente MXPaylink.
 * @param {number} customerId - El ID del cliente MXPaylink que solicita el pago.
 * @param {Object} customerPayPalCreds - Las credenciales de PayPal del cliente MXPaylink (client_id, secret).
 * @param {number} amount - El monto del pago.
 * @param {string} concept - El concepto o descripción del pago.
 * @param {string} finalCustomerName - El nombre del cliente final.
 * @param {string} finalCustomerEmail - El email del cliente final.
 * @returns {string|null} - La approval_url generada por PayPal o null si falla.
 */
const createFinalPaymentLinkForCustomer = async (
    customerId,
    customerPayPalCreds,
    amount,
    concept,
    finalCustomerName,
    finalCustomerEmail
) => {
    logger.info(`[SERVICE PAYMENT GENERATOR] Generando link de pago para cliente final: ${finalCustomerName} (${finalCustomerEmail}), monto: ${amount}, concepto: "${concept}", solicitado por cliente MXPaylink ID: ${customerId}`);

    try {
        // Validar entradas básicas (esto se puede mejorar)
        if (!customerPayPalCreds || !amount || !concept || !finalCustomerName || !finalCustomerEmail) {
            logger.error(`[SERVICE PAYMENT GENERATOR] Datos insuficientes para generar el pago. Recibido:`, {
                customerId,
                hasCreds: !!customerPayPalCreds,
                amount,
                concept,
                finalCustomerName,
                finalCustomerEmail
            });
            return null;
        }

        // En V1, asumimos que el cliente MXPaylink usa PayPal.
        // En el futuro, aquí se podría elegir el servicio (paypalService, mercadopagoService, etc.) según preferencia o disponibilidad.
        logger.debug(`[SERVICE PAYMENT GENERATOR] Usando PayPal para generar el pago para cliente ID: ${customerId}.`);

        // Llamar al servicio específico de PayPal para crear la orden
        // El servicio PayPal recibirá las credenciales del cliente MXPaylink
        const paymentResult = await paypalService.createOrder(
            customerPayPalCreds, // Las credenciales del cliente MXPaylink
            amount,
            concept,
            finalCustomerName,
            finalCustomerEmail
        );

        if (paymentResult && paymentResult.approvalUrl) {
            logger.info(`[SERVICE PAYMENT GENERATOR] Link de pago generado exitosamente para cliente final ${finalCustomerName}. Link: ${paymentResult.approvalUrl}`);
            return paymentResult.approvalUrl; // Devolver solo la URL de aprobación
        } else {
            logger.error(`[SERVICE PAYMENT GENERATOR] El servicio de PayPal no devolvió una URL válida. Resultado:`, paymentResult);
            return null;
        }

    } catch (error) {
        logger.error(`[SERVICE PAYMENT GENERATOR] Error al generar el link de pago para cliente final ${finalCustomerName} (${finalCustomerEmail}) solicitado por cliente ID ${customerId}:`, error.message);
        // Opcional: Registrar el stack del error para diagnóstico más detallado
        // logger.error('Stack:', error.stack);
        return null;
    }
};

module.exports = {
    createFinalPaymentLinkForCustomer // Exportamos la función principal
};
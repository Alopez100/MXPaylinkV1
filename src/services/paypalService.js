// src/services/paypalService.js
// Responsabilidad: Interactuar específicamente con la API de PayPal para crear órdenes de pago.
// Lógica (Actualizada para V1 sin email del cliente final):
//   - Recibir credenciales del cliente MXPaylink, monto, concepto, nombre del cliente final (opcional).
//   - Obtener un access token de PayPal usando las credenciales.
//   - Crear una orden de pago en PayPal usando el token (sin usar email del cliente final).
//   - Devolver la approval_url y el order_id.

const logger = require('../utils/logger'); // Importamos el logger
const axios = require('axios'); // Necesitamos axios para hacer las solicitudes HTTP a la API de PayPal

// URLs de la API de PayPal (usar sandbox para pruebas, live para producción)
const PAYPAL_API_BASE_SANDBOX = 'https://api.sandbox.paypal.com'; // Cambiar a live si es producción
// const PAYPAL_API_BASE_LIVE = 'https://api.paypal.com';

/**
 * Obtiene un Access Token de PayPal usando las credenciales del cliente.
 * @param {Object} creds - Las credenciales de PayPal del cliente MXPaylink (client_id, secret).
 * @returns {Promise<string>} - El access token obtenido.
 */
const getAccessToken = async (creds) => {
    logger.debug('[PAYPAL SERVICE] Intentando obtener Access Token de PayPal.');

    const { client_id, secret } = creds;

    if (!client_id || !secret) {
        logger.error('[PAYPAL SERVICE] Credenciales de PayPal incompletas (falta client_id o secret).');
        throw new Error('Credenciales de PayPal inválidas.');
    }

    // Codificar las credenciales en Base64 para la cabecera de autorización
    const auth = Buffer.from(`${client_id}:${secret}`).toString('base64');

    const tokenUrl = `${PAYPAL_API_BASE_SANDBOX}/v1/oauth2/token`;

    try {
        const response = await axios({
            method: 'post',
            url: tokenUrl,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: 'grant_type=client_credentials',
        });

        logger.info('[PAYPAL SERVICE] Access Token de PayPal obtenido exitosamente.');
        return response.data.access_token;

    } catch (error) {
        logger.error('[PAYPAL SERVICE] Error al obtener Access Token de PayPal:', error.message);
        if (error.response) {
            logger.error('[PAYPAL SERVICE] Detalles del error de PayPal:', error.response.data);
        }
        // Re-lanzar el error para que el módulo superior lo maneje
        throw new Error('No se pudo autenticar con PayPal.');
    }
};

/**
 * Crea una orden de pago en PayPal.
 * @param {Object} creds - Las credenciales de PayPal del cliente MXPaylink (client_id, secret).
 * @param {number} amount - El monto del pago.
 * @param {string} concept - El concepto o descripción del pago.
 * @param {string} finalCustomerName - El nombre del cliente final (opcional para PayPal).
 * @param {string|null|undefined} finalCustomerEmail - El email del cliente final (ahora opcional o no usado).
 * @returns {Promise<Object|null>} - Un objeto con { approvalUrl, orderId } o null si falla.
 */
const createOrder = async (creds, amount, concept, finalCustomerName, finalCustomerEmail) => {
    logger.info(`[PAYPAL SERVICE] Creando orden de pago en PayPal para cliente final: ${finalCustomerName || 'No especificado'} (${finalCustomerEmail || 'No especificado'}), monto: ${amount}, concepto: "${concept}".`);

    try {
        // 1. Obtener el Access Token
        const accessToken = await getAccessToken(creds);

        // 2. Preparar los datos de la orden
        const orderData = {
            intent: 'CAPTURE', // Capturar inmediatamente después de la aprobación
            purchase_units: [{
                amount: {
                    currency_code: 'USD', // O 'MXN' si se configura en PayPal
                    value: amount.toString() // Convertir el número a string
                },
                description: concept, // Descripción del pago
                // Opcional: Incluir información del pagador (NO incluimos email del cliente final)
                // payee: {
                //     // email_address: finalCustomerEmail // <-- COMENTADO/ELIMINADO: No se usa el email del cliente final
                // },
                // Opcional: Pasar el nombre del cliente final si PayPal lo permite (no es obligatorio para la orden)
                // shipping: {
                //     name: {
                //         full_name: finalCustomerName // <-- PUEDE COMENTARSE si no es necesario
                //     }
                // }
            }],
            // Configurar URLs de retorno (esto es para el flujo web, no esencial para el link enviado por WhatsApp)
            // application_context: {
            //     brand_name: "MXPaylink", // Nombre de tu tienda
            //     locale: "es-MX", // Idioma
            //     landing_page: "BILLING", // Página de inicio en PayPal
            //     user_action: "PAY_NOW", // Botón de acción
            //     return_url: "https://tu-dominio.com/paypal-return", // No se usa directamente aquí
            //     cancel_url: "https://tu-dominio.com/paypal-cancel" // No se usa directamente aquí
            // }
        };

        logger.debug(`[PAYPAL SERVICE] Datos de la orden que se enviarán a PayPal:`, orderData);

        // 3. Hacer la solicitud POST para crear la orden
        const orderUrl = `${PAYPAL_API_BASE_SANDBOX}/v2/checkout/orders`;
        const response = await axios({
            method: 'post',
            url: orderUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                // Opcional: Agregar un User-Agent para identificar la aplicación
                'User-Agent': 'MXPaylink-App/1.0'
            },
            data: orderData,
        });

        logger.info(`[PAYPAL SERVICE] Orden de pago creada exitosamente en PayPal para cliente final ${finalCustomerName || 'No especificado'}. ID: ${response.data.id}`);

        // 4. Extraer la approval_url del response
        const approvalUrl = response.data.links.find(link => link.rel === 'approve')?.href;

        if (!approvalUrl) {
            logger.error(`[PAYPAL SERVICE] No se encontró la approval_url en la respuesta de PayPal para la orden ${response.data.id}.`);
            return null;
        }

        logger.info(`[PAYPAL SERVICE] Link de aprobación generado: ${approvalUrl}`);
        return {
            approvalUrl: approvalUrl,
            orderId: response.data.id // Devolvemos también el ID de la orden si se necesita para futuras referencias
        };

    } catch (error) {
        logger.error(`[PAYPAL SERVICE] Error al crear la orden de pago en PayPal para cliente final ${finalCustomerName || 'No especificado'} (${finalCustomerEmail || 'No especificado'}):`, error.message);
        if (error.response) {
            logger.error('[PAYPAL SERVICE] Detalles del error de PayPal:', error.response.data);
        }
        // Devolvemos null para indicar fallo al módulo superior
        return null;
    }
};

module.exports = {
    createOrder // Exportamos la función principal para crear órdenes
    // Opcional: Exportar getAccessToken si se necesita en otro lugar
    // getAccessToken
};
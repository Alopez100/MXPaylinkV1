// src/services/paypalService.js
// Responsabilidad: Interactuar con la API de PayPal para crear órdenes de pago y obtener tokens de acceso.
// Lógica (Original, asumiendo objeto { client_id, secret }):
// - createOrder: Recibe credenciales del cliente MXPaylink, monto, concepto, etc.
// - (Internamente llama a getAccessToken).
// - getAccessToken: Obtiene un access token de PayPal usando las credenciales del cliente MXPaylink.

const axios = require('axios'); // Importar axios para hacer solicitudes HTTP
const logger = require('../utils/logger'); // Importamos el logger

// Obtener las URLs de la API de PayPal desde variables de entorno
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api.sandbox.paypal.com'; // Sandbox por defecto
const PAYPAL_TOKEN_URL = `${PAYPAL_API_BASE}/v1/oauth2/token`;

/**
 * Obtiene un access token de PayPal usando las credenciales del cliente MXPaylink.
 * @param {Object} creds - Las credenciales del cliente MXPaylink en formato { client_id, secret }.
 * @returns {Promise<string|null>} - El access token o null si falla.
 */
const getAccessToken = async (creds) => {
  logger.debug('[PAYPAL SERVICE] Intentando obtener Access Token de PayPal.');

  // Validar que tengamos un objeto con client_id y secret
  if (!creds || !creds.client_id || !creds.secret) {
    logger.error('[PAYPAL SERVICE] Credenciales de PayPal incompletas (falta client_id o secret).');
    logger.error('[PAYPAL SERVICE] Valor recibido para creds:', creds); // Log detallado para diagnóstico
    return null;
  }

  const { client_id, secret } = creds; // Extraer directamente del objeto

  try {
    // Codificar las credenciales en Base64 para la autenticación Basic
    const encodedCreds = Buffer.from(`${client_id}:${secret}`).toString('base64');

    // Configurar la solicitud POST para obtener el token
    // El cuerpo debe ser application/x-www-form-urlencoded
    const config = {
      method: 'post',
      url: PAYPAL_TOKEN_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded', // Tipo de contenido correcto
        'Authorization': `Basic ${encodedCreds}`, // Autenticación Basic con credenciales codificadas
        'User-Agent': 'MXPaylink-App/1.0' // Identificar la aplicación
      },
      // El cuerpo de la solicitud debe ser una cadena formateada como application/x-www-form-urlencoded
      data: 'grant_type=client_credentials', // Cuerpo correcto para obtener token de cliente
    };

    // Hacer la solicitud a PayPal
    const response = await axios(config);

    // Extraer el access token del response
    const accessToken = response.data.access_token;

    if (!accessToken) {
      logger.error('[PAYPAL SERVICE] No se recibió un access_token válido en la respuesta de PayPal.');
      return null;
    }

    logger.info('[PAYPAL SERVICE] Access Token de PayPal obtenido exitosamente.');
    return accessToken; // Devolver el access token

  } catch (error) {
    // Manejar errores de la solicitud HTTP
    logger.error('[PAYPAL SERVICE] Error al obtener el Access Token de PayPal:', error.message);
    if (error.response) {
      logger.error('[PAYPAL SERVICE] Detalles del error de PayPal (Status, Data):', error.response.status, error.response.data);
    }
    return null; // Devolver null para indicar fallo
  }
};

/**
 * Crea una orden de pago en PayPal para el cliente final.
 * @param {Object} creds - Las credenciales de PayPal del cliente MXPaylink (client_id, secret).
 * @param {number} amount - El monto del pago.
 * @param {string} concept - El concepto o descripción del pago.
 * @param {string} finalCustomerName - El nombre del cliente final (opcional para PayPal).
 * @param {string|null|undefined} finalCustomerEmail - El email del cliente final (ahora opcional o no usado).
 * @returns {Promise<Object|null>} - Un objeto con { approvalUrl, orderId } o null si falla.
 */
const createOrder = async (creds, amount, concept, finalCustomerName, finalCustomerEmail) => {
  logger.info(`[PAYPAL SERVICE] Creando orden de pago en PayPal para cliente final: ${finalCustomerName || 'No especificado'}, monto: ${amount}, concepto: "${concept}".`);

  // Obtener el access token usando las credenciales del cliente MXPaylink
  const accessToken = await getAccessToken(creds);

  if (!accessToken) {
    logger.error('[PAYPAL SERVICE] No se pudo obtener el access token. Cancelando creación de orden.');
    return null; // Detener si no hay token
  }

  // Definir la data para crear la orden en PayPal
  const orderData = {
    intent: 'CAPTURE', // Capturar inmediatamente después de la aprobación
    purchase_units: [{
      amount: {
        currency_code: 'USD', // Asegúrate de usar la moneda correcta
        value: amount.toString(), // Convertir a string
      },
      description: concept, // Descripción del pago
    }],
  };

  try {
    // Configurar la solicitud POST para crear la orden
    const config = {
      method: 'post',
      url: `${PAYPAL_API_BASE}/v2/checkout/orders`, // Endpoint para crear órdenes V2
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // Usar el access token obtenido
        'User-Agent': 'MXPaylink-App/1.0'
      },
       orderData,
    };

    // Hacer la solicitud a PayPal
    const response = await axios(config);

    logger.info(`[PAYPAL SERVICE] Orden de pago creada exitosamente en PayPal para cliente final ${finalCustomerName || 'No especificado'}. ID: ${response.data.id}`);

    // 4. Extraer la approval_url del response
    const approvalUrl = response.data.links.find(link => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      logger.error(`[PAYPAL SERVICE] No se encontró la approval_url en la respuesta de PayPal para la orden ${response.data.id}.`);
      return null;
    }

    logger.info(`[PAYPAL SERVICE] Link de aprobación generado: ${approvalUrl}`);

    return {
      approvalUrl, // Devolver la URL de aprobación
      orderId: response.data.id // Devolver el ID de la orden
    };

  } catch (error) {
    // Manejar errores de la solicitud de creación de orden
    logger.error(`[PAYPAL SERVICE] Error al crear la orden de pago en PayPal para cliente final ${finalCustomerName || 'No especificado'}:`, error.message);
    if (error.response) {
      logger.error('[PAYPAL SERVICE] Detalles del error de creación de orden (Status, Data):', error.response.status, error.response.data);
    }
    return null;
  }
};

module.exports = {
  createOrder,
  // getAccessToken // Opcional: Exportar si se necesita en otro lugar
};
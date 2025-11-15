// src/services/paypalService.js
// Responsabilidad: Interactuar con la API de PayPal para crear órdenes de pago y obtener tokens de acceso.
// Lógica (Actualizada para manejar credenciales antiguas):
// - createOrder: Recibe credenciales del cliente MXPaylink, monto, concepto, etc.
// - (Internamente llama a getAccessToken).
// - getAccessToken: Obtiene un access token de PayPal usando las credenciales del cliente MXPaylink.
// - La función getAccessToken ahora maneja tanto el formato { client_id, secret } como { algunaClave: "client_id:secret" }.

const axios = require('axios'); // Importar axios para hacer solicitudes HTTP
const logger = require('../utils/logger'); // Importamos el logger

// --- Opcional: Importar la función de desencriptación si se almacenan encriptadas en el .env ---
// const { decrypt } = require('../utils/encryptionUtils'); // Si se usa para credenciales de app propias

// Obtener las URLs de la API de PayPal desde variables de entorno
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api.sandbox.paypal.com'; // Sandbox por defecto
const PAYPAL_TOKEN_URL = `${PAYPAL_API_BASE}/v1/oauth2/token`;

/**
 * Obtiene un access token de PayPal usando las credenciales del cliente MXPaylink.
 * @param {Object} creds - Las credenciales del cliente MXPaylink. Puede ser { client_id, secret } o { algunaClave: "client_id:secret" }.
 * @returns {Promise<string|null>} - El access token o null si falla.
 */
const getAccessToken = async (creds) => {
  logger.debug('[PAYPAL SERVICE] Intentando obtener Access Token de PayPal.');

  // --- Lógica para manejar ambos formatos de credenciales ---
  let client_id, secret;

  if (creds && typeof creds === 'object') {
    // Intentar obtener directamente de un objeto { client_id, secret }
    if (creds.client_id && creds.secret) {
      client_id = creds.client_id;
      secret = creds.secret;
      logger.debug('[PAYPAL SERVICE] Credenciales encontradas en formato actual: { client_id, secret }');
    } else {
      // Si no están directamente, buscar la cadena "client_id:secret" en alguna propiedad del objeto
      const keys = Object.keys(creds);
      for (const key of keys) {
        const value = creds[key];
        if (typeof value === 'string' && value.includes(':')) {
          const parts = value.split(':');
          if (parts.length === 2) {
            client_id = parts[0];
            secret = parts[1];
            logger.debug(`[PAYPAL SERVICE] Credenciales encontradas en formato antiguo dentro de la propiedad '${key}': ${value}`);
            break; // Encontramos el formato, salimos del bucle
          }
        }
      }
    }
  }

  // Validar que tengamos client_id y secret
  if (!client_id || !secret) {
    logger.error('[PAYPAL SERVICE] Credenciales de PayPal incompletas (falta client_id o secret).');
    logger.error('[PAYPAL SERVICE] Valor recibido para creds:', creds); // Log detallado para diagnóstico
    return null;
  }

  // --- Fin de la lógica de manejo de credenciales ---

  try {
    // Codificar las credenciales en Base64 para la autenticación Basic
    const encodedCreds = Buffer.from(`${client_id}:${secret}`).toString('base64');

    // Configurar la solicitud POST para obtener el token
    const config = {
      method: 'post',
      url: PAYPAL_TOKEN_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${encodedCreds}`, // Autenticación Basic con credenciales codificadas
        'User-Agent': 'MXPaylink-App/1.0' // Identificar la aplicación
      },
      data: 'grant_type=client_credentials', // Tipo de grant para obtener un access token
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
  const accessToken = await getAccessToken(creds); // Pasamos 'creds' completo

  if (!accessToken) {
    logger.error('[PAYPAL SERVICE] No se pudo obtener el access token. Cancelando creación de orden.');
    return null; // Detener si no hay token
  }

  // Definir la data para crear la orden en PayPal
  // Importante: No incluir información del cliente final aquí si no es requerido por tu modelo de negocio de PayPal
  // (Por ejemplo, si facturas a nombre del cliente MXPaylink y él cobra a su cliente final).
  const orderData = {
    intent: 'CAPTURE', // Capturar inmediatamente después de la aprobación
    purchase_units: [{
      amount: {
        currency_code: 'USD', // Asegúrate de usar la moneda correcta
        value: amount.toString(), // Convertir a string
      },
      description: concept, // Descripción del pago
      // Opcional: Puedes incluir custom_id si necesitas asociar la orden con tu sistema interno
      // custom_id: customerId.toString() // Si se desea asociar al cliente MXPaylink
    }],
    // application_context: { // Opcional: Configurar el contexto del pago
    //   brand_name: 'MXPaylink', // Nombre de tu marca
    //   locale: 'es-MX', // Localización
    //   landing_page: 'BILLING', // Página de destino
    //   user_action: 'PAY_NOW', // Acción que verá el usuario
    //   return_url: process.env.PAYPAL_RETURN_URL_BASE, // URL a la que se redirige tras pago
    //   cancel_url: process.env.PAYPAL_CANCEL_URL_BASE, // URL a la que se redirige si cancela
    // },
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
      data: orderData,
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
    // Devolver null para indicar fallo al módulo superior
    return null;
  }
};

module.exports = {
  createOrder, // Exportamos la función principal para crear órdenes
  // Opcional: Exportar getAccessToken si se necesita en otro lugar
  // getAccessToken
};

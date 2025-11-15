// src/services/customerDB.js
// Responsabilidad: Interactuar con la base de datos de clientes PostgreSQL real para encontrar registros y desencriptar credenciales.
// Lógica (Actualizada para manejar formatos antiguos y nuevos):
//   - findCustomerByPhoneNumber: Busca un cliente por su número de teléfono en la base de datos real.
//   - Desencripta y convierte credenciales almacenadas (PayPal, Conekta, MP) al formato { client_id, secret } o equivalente.
//   - (La desencriptación ahora se delega a encryptionUtils.js)

const { Pool } = require('pg'); // Importar Pool de pg
const logger = require('../utils/logger'); // Importamos el logger
const { decrypt } = require('../utils/encryptionUtils'); // Importamos la función de desencriptación desde el nuevo módulo

// Obtener la cadena de conexión desde las variables de entorno
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

// Configurar el pool de conexiones
const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.DB_SSL_REQUIRED === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * Convierte una cadena en formato 'client_id:secret' a un objeto { client_id, secret }.
 * @param {string} credsString - La cadena a convertir.
 * @returns {Object|null} - El objeto { client_id, secret } o null si el formato es incorrecto.
 */
function convertFromLegacyFormat(credsString) {
  if (typeof credsString === 'string' && credsString.includes(':')) {
    const parts = credsString.split(':');
    if (parts.length === 2) {
      return {
        client_id: parts[0],
        secret: parts[1]
      };
    }
  }
  return null;
}

/**
 * Busca un cliente en la base de datos PostgreSQL por su número de teléfono.
 * @param {string} phoneNumber - El número de teléfono a buscar.
 * @returns {Promise<Object|null>} - El objeto cliente si se encuentra y se desencriptan las credenciales correctamente, o null si no.
 */
const findCustomerByPhoneNumber = async (phoneNumber) => {
  logger.debug(`[CUSTOMER DB] Buscando cliente con teléfono: ${phoneNumber} en la base de datos real.`);

  const client = await pool.connect(); // Obtener un cliente del pool
  try {
    const query = 'SELECT id, phone, email, service_status, paypal_creds, conekta_creds, mercadopago_creds FROM clients WHERE phone = $1';
    const values = [phoneNumber];
    const result = await client.query(query, values);

    if (result.rows.length > 0) {
      let customer = result.rows[0];
      logger.info(`[CUSTOMER DB] Cliente encontrado en DB: ${customer.phone}. ID: ${customer.id}`);

      // --- Desencriptar y procesar credenciales PayPal ---
      if (customer.paypal_creds) {
        logger.debug(`[CUSTOMER DB] Llamando a decrypt para credenciales PayPal cliente ${customer.id}. Valor a desencriptar (longitud):`, customer.paypal_creds.length);
        try {
          const decryptedPayPalCredsString = decrypt(customer.paypal_creds);
          logger.debug(`[CUSTOMER DB] Resultado de decrypt PayPal para cliente ${customer.id}:`, {
            tipoResultado: typeof decryptedPayPalCredsString,
            tieneContenido: typeof decryptedPayPalCredsString === 'string' && decryptedPayPalCredsString.length > 0,
            longitudResultado: typeof decryptedPayPalCredsString === 'string' ? decryptedPayPalCredsString.length : 'No es string valido'
          });

          if (decryptedPayPalCredsString) {
            let parsedCreds = null;
            // Intentar parsear como JSON
            try {
              parsedCreds = JSON.parse(decryptedPayPalCredsString);
              logger.debug(`[CUSTOMER DB] Credenciales PayPal desencriptadas y parseadas como JSON para cliente ${customer.id}.`);
            } catch (jsonParseError) {
              logger.warn(`[CUSTOMER DB] Error al parsear credenciales PayPal como JSON para cliente ${customer.id}:`, jsonParseError.message);
              logger.debug(`[CUSTOMER DB] Intentando formato legacy 'client_id:secret' para cliente ${customer.id}.`);
              // Si falla el parseo JSON, intentar formato legacy
              parsedCreds = convertFromLegacyFormat(decryptedPayPalCredsString);
              if (parsedCreds) {
                logger.info(`[CUSTOMER DB] Credenciales PayPal convertidas desde formato legacy para cliente ${customer.id}.`);
              } else {
                logger.error(`[CUSTOMER DB] No se pudo interpretar las credenciales PayPal desencriptadas para cliente ${customer.id}. Formato no válido.`);
                customer.paypal_creds = null;
                // Opcional: retornar temprano si es crítico
              }
            }
            customer.paypal_creds = parsedCreds; // Asignar el objeto ya sea JSON o convertido
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar las credenciales PayPal para cliente ${customer.id}. Valor en DB: ${customer.paypal_creds}`);
             customer.paypal_creds = null;
          }
        } catch (decryptError) {
          logger.error(`[CUSTOMER DB] Error al desencriptar las credenciales PayPal para cliente ${customer.id}:`, decryptError.message);
          customer.paypal_creds = null;
        }
      } else {
        logger.debug(`[CUSTOMER DB] Cliente ${customer.id} no tiene credenciales PayPal almacenadas.`);
        customer.paypal_creds = null;
      }

      // --- Desencriptar y procesar credenciales Conekta (similar a PayPal) ---
      if (customer.conekta_creds) {
        logger.debug(`[CUSTOMER DB] Llamando a decrypt para credenciales Conekta cliente ${customer.id}. Valor a desencriptar (longitud):`, customer.conekta_creds.length);
        try {
          const decryptedConektaCredsString = decrypt(customer.conekta_creds);
          logger.debug(`[CUSTOMER DB] Resultado de decrypt Conekta para cliente ${customer.id}:`, {
            tipoResultado: typeof decryptedConektaCredsString,
            tieneContenido: typeof decryptedConektaCredsString === 'string' && decryptedConektaCredsString.length > 0,
            longitudResultado: typeof decryptedConektaCredsString === 'string' ? decryptedConektaCredsString.length : 'No es string valido'
          });

          if (decryptedConektaCredsString) {
            let parsedCreds = null;
            try {
              parsedCreds = JSON.parse(decryptedConektaCredsString);
              logger.debug(`[CUSTOMER DB] Credenciales Conekta desencriptadas y parseadas como JSON para cliente ${customer.id}.`);
            } catch (jsonParseError) {
              logger.warn(`[CUSTOMER DB] Error al parsear credenciales Conekta como JSON para cliente ${customer.id}:`, jsonParseError.message);
              logger.debug(`[CUSTOMER DB] Intentando formato legacy para cliente ${customer.id}. (Lógica específica si aplica)`);
              // Aquí puedes aplicar la lógica de convertFromLegacyFormat si Conekta también usa un formato legacy específico
              // parsedCreds = convertFromLegacyFormat(decryptedConektaCredsString);
              // Si no hay formato legacy para Conekta, o no coincide, dejar como null o manejar según sea necesario.
              logger.error(`[CUSTOMER DB] No se pudo interpretar las credenciales Conekta desencriptadas para cliente ${customer.id}. Formato no válido o legacy no soportado.`);
              customer.conekta_creds = null;
              // Opcional: retornar temprano si Conekta es crítico
            }
            customer.conekta_creds = parsedCreds;
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar las credenciales Conekta para cliente ${customer.id}.`);
             customer.conekta_creds = null;
          }
        } catch (decryptError) {
          logger.error(`[CUSTOMER DB] Error al desencriptar las credenciales Conekta para cliente ${customer.id}:`, decryptError.message);
          customer.conekta_creds = null;
        }
      } else {
        logger.debug(`[CUSTOMER DB] Cliente ${customer.id} no tiene credenciales Conekta almacenadas.`);
        customer.conekta_creds = null;
      }

      // --- Desencriptar y procesar credenciales MercadoPago (similar a PayPal) ---
      if (customer.mercadopago_creds) {
        logger.debug(`[CUSTOMER DB] Llamando a decrypt para credenciales MercadoPago cliente ${customer.id}. Valor a desencriptar (longitud):`, customer.mercadopago_creds.length);
        try {
          const decryptedMercadoPagoCredsString = decrypt(customer.mercadopago_creds);
          logger.debug(`[CUSTOMER DB] Resultado de decrypt MercadoPago para cliente ${customer.id}:`, {
            tipoResultado: typeof decryptedMercadoPagoCredsString,
            tieneContenido: typeof decryptedMercadoPagoCredsString === 'string' && decryptedMercadoPagoCredsString.length > 0,
            longitudResultado: typeof decryptedMercadoPagoCredsString === 'string' ? decryptedMercadoPagoCredsString.length : 'No es string valido'
          });

          if (decryptedMercadoPagoCredsString) {
            let parsedCreds = null;
            try {
              parsedCreds = JSON.parse(decryptedMercadoPagoCredsString);
              logger.debug(`[CUSTOMER DB] Credenciales MercadoPago desencriptadas y parseadas como JSON para cliente ${customer.id}.`);
            } catch (jsonParseError) {
              logger.warn(`[CUSTOMER DB] Error al parsear credenciales MercadoPago como JSON para cliente ${customer.id}:`, jsonParseError.message);
              logger.debug(`[CUSTOMER DB] Intentando formato legacy para cliente ${customer.id}. (Lógica específica si aplica)`);
              // Aplicar lógica de conversión si MercadoPago tiene un formato legacy específico
              // parsedCreds = convertFromLegacyFormat(decryptedMercadoPagoCredsString);
              logger.error(`[CUSTOMER DB] No se pudo interpretar las credenciales MercadoPago desencriptadas para cliente ${customer.id}. Formato no válido o legacy no soportado.`);
              customer.mercadopago_creds = null;
              // Opcional: retornar temprano si MercadoPago es crítico
            }
            customer.mercadopago_creds = parsedCreds;
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar las credenciales MercadoPago para cliente ${customer.id}.`);
             customer.mercadopago_creds = null;
          }
        } catch (decryptError) {
          logger.error(`[CUSTOMER DB] Error al desencriptar las credenciales MercadoPago para cliente ${customer.id}:`, decryptError.message);
          customer.mercadopago_creds = null;
        }
      } else {
        logger.debug(`[CUSTOMER DB] Cliente ${customer.id} no tiene credenciales MercadoPago almacenadas.`);
        customer.mercadopago_creds = null;
      }

      return customer;
    } else {
      logger.info(`[CUSTOMER DB] Cliente NO encontrado para teléfono: ${phoneNumber}.`);
      return null;
    }
  } catch (error) {
    logger.error(`[CUSTOMER DB] Error al buscar cliente en la base de datos:`, error.message);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findCustomerByPhoneNumber
};
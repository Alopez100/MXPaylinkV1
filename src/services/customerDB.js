// src/services/customerDB.js
// Responsabilidad: Interactuar con la base de datos de clientes PostgreSQL real para encontrar registros y desencriptar credenciales.
// Lógica (Actualizada para manejar formatos antiguos y nuevos):
//   - findCustomerByPhoneNumber: Busca un cliente por su número de teléfono en la base de datos real.
//   - Desencripta y convierte credenciales almacenadas (PayPal, Conekta, MP) al formato { client_id, secret } o equivalente.
//   - (La desencriptación ahora se delega a credentialDecryptor.js)

const { Pool } = require('pg'); // Importar Pool de pg
const logger = require('../utils/logger'); // Importamos el logger
// --- CAMBIO AQUÍ: Importar el módulo modularizado ---
const { decryptProviderCredentials } = require('../utils/credentialDecryptor'); // Delegamos la lógica de desencriptación a credentialDecryptor.js
// const { decrypt } = require('../utils/encryptionUtils'); // <-- Comentado, ya no se usa directamente aquí

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
        logger.debug(`[CUSTOMER DB] Llamando a decryptProviderCredentials para credenciales PayPal cliente ${customer.id}.`);
        try {
          // --- CAMBIO AQUÍ: Usar el módulo credentialDecryptor.js ---
          const parsedCreds = decryptProviderCredentials(customer.paypal_creds, 'PayPal', customer.id);

          if (parsedCreds) {
            logger.debug(`[CUSTOMER DB] Credenciales PayPal desencriptadas y procesadas exitosamente para cliente ${customer.id}.`);
            customer.paypal_creds = parsedCreds; // Asignar el objeto { client_id, secret }
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar ni procesar las credenciales PayPal para cliente ${customer.id}. Valor en DB: ${customer.paypal_creds}`);
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
        logger.debug(`[CUSTOMER DB] Llamando a decryptProviderCredentials para credenciales Conekta cliente ${customer.id}.`);
        try {
          // --- CAMBIO AQUÍ: Usar el módulo credentialDecryptor.js ---
          const parsedCreds = decryptProviderCredentials(customer.conekta_creds, 'Conekta', customer.id);

          if (parsedCreds) {
            logger.debug(`[CUSTOMER DB] Credenciales Conekta desencriptadas y procesadas exitosamente para cliente ${customer.id}.`);
            customer.conekta_creds = parsedCreds;
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar ni procesar las credenciales Conekta para cliente ${customer.id}.`);
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
        logger.debug(`[CUSTOMER DB] Llamando a decryptProviderCredentials para credenciales MercadoPago cliente ${customer.id}.`);
        try {
          // --- CAMBIO AQUÍ: Usar el módulo credentialDecryptor.js ---
          const parsedCreds = decryptProviderCredentials(customer.mercadopago_creds, 'MercadoPago', customer.id);

          if (parsedCreds) {
            logger.debug(`[CUSTOMER DB] Credenciales MercadoPago desencriptadas y procesadas exitosamente para cliente ${customer.id}.`);
            customer.mercadopago_creds = parsedCreds;
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar ni procesar las credenciales MercadoPago para cliente ${customer.id}.`);
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
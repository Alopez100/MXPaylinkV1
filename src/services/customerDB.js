// src/services/customerDB.js
// Responsabilidad: Interactuar con la base de datos de clientes PostgreSQL real para encontrar registros y desencriptar credenciales.
// Lógica:
//   - findCustomerByPhoneNumber: Busca un cliente por su número de teléfono en la base de datos real.
//   - (La desencriptación ahora se delega a encryptionUtils.js)

const { Pool } = require('pg'); // Importar Pool de pg
// --- ELIMINADO: const crypto = require('crypto'); // Ya no es necesario aquí ---
const logger = require('../utils/logger'); // Importamos el logger
// --- AÑADIDO: Importar la función de desencriptación ---
const { decrypt } = require('../utils/encryptionUtils'); // Importamos la función de desencriptación desde el nuevo módulo

// Obtener la cadena de conexión desde las variables de entorno
// Usamos DATABASE_URL si está definida (como en Render) o construimos la URL manualmente
// En Render, DATABASE_URL suele estar disponible y es preferible.
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

// Configurar el pool de conexiones
// Es importante usar SSL para conexiones a Render
const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.DB_SSL_REQUIRED === 'true' ? { rejectUnauthorized: false } : false, // Configurar SSL según sea necesario
});

// --- ELIMINADO: La función decrypt anterior ---
// function decrypt(text) { ... }


/**
 * Busca un cliente en la base de datos PostgreSQL por su número de teléfono.
 * @param {string} phoneNumber - El número de teléfono a buscar.
 * @returns {Promise<Object|null>} - El objeto cliente si se encuentra y se desencriptan las credenciales correctamente, o null si no.
 */
const findCustomerByPhoneNumber = async (phoneNumber) => {
  logger.debug(`[CUSTOMER DB] Buscando cliente con teléfono: ${phoneNumber} en la base de datos real.`);

  const client = await pool.connect(); // Obtener un cliente del pool
  try {
    // Consulta SQL para buscar al cliente
    const query = 'SELECT id, phone, email, service_status, paypal_creds, conekta_creds, mercadopago_creds FROM clients WHERE phone = $1';
    const values = [phoneNumber];
    const result = await client.query(query, values);

    if (result.rows.length > 0) {
      let customer = result.rows[0];
      logger.info(`[CUSTOMER DB] Cliente encontrado en DB: ${customer.phone}. ID: ${customer.id}`);

      // Desencriptar las credenciales almacenadas
      // Asumiendo que paypal_creds, conekta_creds, mercadopago_creds son JSON encriptados como cadenas
      // El sistema anterior las almacenaba como JSON.stringify(encrypt({client_id, secret}))

      // Desencriptar PayPal
      if (customer.paypal_creds) {
        try {
          const decryptedPayPalCredsString = decrypt(customer.paypal_creds);
          if (decryptedPayPalCredsString) {
            customer.paypal_creds = JSON.parse(decryptedPayPalCredsString);
            logger.debug(`[CUSTOMER DB] Credenciales PayPal desencriptadas para cliente ${customer.id}.`);
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar las credenciales PayPal para cliente ${customer.id}. Valor en DB: ${customer.paypal_creds}`);
             customer.paypal_creds = null; // Indicar que falló la desencriptación
          }
        } catch (parseError) {
          logger.error(`[CUSTOMER DB] Error al parsear las credenciales PayPal desencriptadas para cliente ${customer.id}:`, parseError.message);
          customer.paypal_creds = null; // Indicar que falló la desencriptación o el parseo
        }
      } else {
        logger.debug(`[CUSTOMER DB] Cliente ${customer.id} no tiene credenciales PayPal almacenadas.`);
        customer.paypal_creds = null;
      }

      // Desencriptar Conekta (opcional, ejemplo similar)
      if (customer.conekta_creds) {
        try {
          const decryptedConektaCredsString = decrypt(customer.conekta_creds);
          if (decryptedConektaCredsString) {
            customer.conekta_creds = JSON.parse(decryptedConektaCredsString);
            logger.debug(`[CUSTOMER DB] Credenciales Conekta desencriptadas para cliente ${customer.id}.`);
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar las credenciales Conekta para cliente ${customer.id}.`);
             customer.conekta_creds = null;
          }
        } catch (parseError) {
          logger.error(`[CUSTOMER DB] Error al parsear las credenciales Conekta desencriptadas para cliente ${customer.id}:`, parseError.message);
          customer.conekta_creds = null;
        }
      } else {
        logger.debug(`[CUSTOMER DB] Cliente ${customer.id} no tiene credenciales Conekta almacenadas.`);
        customer.conekta_creds = null;
      }

      // Desencriptar MercadoPago (opcional, ejemplo similar)
      if (customer.mercadopago_creds) {
        try {
          const decryptedMercadoPagoCredsString = decrypt(customer.mercadopago_creds);
          if (decryptedMercadoPagoCredsString) {
            customer.mercadopago_creds = JSON.parse(decryptedMercadoPagoCredsString);
            logger.debug(`[CUSTOMER DB] Credenciales MercadoPago desencriptadas para cliente ${customer.id}.`);
          } else {
             logger.error(`[CUSTOMER DB] No se pudo desencriptar las credenciales MercadoPago para cliente ${customer.id}.`);
             customer.mercadopago_creds = null;
          }
        } catch (parseError) {
          logger.error(`[CUSTOMER DB] Error al parsear las credenciales MercadoPago desencriptadas para cliente ${customer.id}:`, parseError.message);
          customer.mercadopago_creds = null;
        }
      } else {
        logger.debug(`[CUSTOMER DB] Cliente ${customer.id} no tiene credenciales MercadoPago almacenadas.`);
        customer.mercadopago_creds = null;
      }

      // Devolver el cliente con las credenciales ya desencriptadas y parseadas
      return customer;
    } else {
      logger.info(`[CUSTOMER DB] Cliente NO encontrado para teléfono: ${phoneNumber}.`);
      return null;
    }
  } catch (error) {
    logger.error(`[CUSTOMER DB] Error al buscar cliente en la base de datos:`, error.message);
    throw error; // Re-lanzar el error para que el módulo superior lo maneje
  } finally {
    client.release(); // Siempre liberar el cliente del pool
  }
};

module.exports = {
  findCustomerByPhoneNumber // Exportamos la función de búsqueda
};
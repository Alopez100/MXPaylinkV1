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

      // --- LOG DE DIAGNÓSTICO 1: Información básica antes de desencriptar ---
      logger.debug(`[CUSTOMER DB] Cliente encontrado en DB para ${phoneNumber}:`, {
        tienePaypalCreds: !!customer.paypal_creds, // Muestra true o false
        tipoPaypalCreds: typeof customer.paypal_creds, // Muestra 'string', 'object', etc.
        longitudCadenaEncriptada: typeof customer.paypal_creds === 'string' ? customer.paypal_creds.length : 'No es string' // Muestra la longitud si es string
        // No se loguea el valor directo de customer.paypal_creds
      });

      // Desencriptar las credenciales almacenadas
      // Asumiendo que paypal_creds, conekta_creds, mercadopago_creds son JSON encriptados como cadenas
      // El sistema anterior las almacenaba como JSON.stringify(encrypt({client_id, secret}))

      // Desencriptar PayPal
      if (customer.paypal_creds) {
        // --- LOG DE DIAGNÓSTICO 2: Información antes de llamar a decrypt ---
        logger.debug(`[CUSTOMER DB] Llamando a decrypt para cliente ${customer.id}. Valor a desencriptar (longitud):`, customer.paypal_creds.length);

        try {
          const decryptedPayPalCredsString = decrypt(customer.paypal_creds);

          // --- LOG DE DIAGNÓSTICO 3: Resultado de la función decrypt ---
          logger.debug(`[CUSTOMER DB] Resultado de decrypt para cliente ${customer.id}:`, {
            tipoResultado: typeof decryptedPayPalCredsString, // 'string', 'object', 'null', etc.
            tieneContenido: typeof decryptedPayPalCredsString === 'string' && decryptedPayPalCredsString.length > 0, // true si es string con contenido
            longitudResultado: typeof decryptedPayPalCredsString === 'string' ? decryptedPayPalCredsString.length : 'No es string valido'
          });

          if (decryptedPayPalCredsString) {
            customer.paypal_creds = JSON.parse(decryptedPayPalCredsString);
            // --- LOG DE DIAGNÓSTICO 4: Contenido del objeto parseado (clave para resolver el problema) ---
            logger.debug(`[CUSTOMER DB] OBJETO PARSEADO de credenciales PayPal para cliente ${customer.id}:`, customer.paypal_creds);

            logger.debug(`[CUSTOMER DB] Credenciales PayPal desencriptadas y parseadas para cliente ${customer.id}.`);
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
        logger.debug(`[CUSTOMER DB] Llamando a decrypt para credenciales Conekta cliente ${customer.id}. Valor a desencriptar (longitud):`, customer.conekta_creds.length);
        try {
          const decryptedConektaCredsString = decrypt(customer.conekta_creds);
          logger.debug(`[CUSTOMER DB] Resultado de decrypt Conekta para cliente ${customer.id}:`, {
            tipoResultado: typeof decryptedConektaCredsString,
            tieneContenido: typeof decryptedConektaCredsString === 'string' && decryptedConektaCredsString.length > 0,
            longitudResultado: typeof decryptedConektaCredsString === 'string' ? decryptedConektaCredsString.length : 'No es string valido'
          });

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
        logger.debug(`[CUSTOMER DB] Llamando a decrypt para credenciales MercadoPago cliente ${customer.id}. Valor a desencriptar (longitud):`, customer.mercadopago_creds.length);
        try {
          const decryptedMercadoPagoCredsString = decrypt(customer.mercadopago_creds);
          logger.debug(`[CUSTOMER DB] Resultado de decrypt MercadoPago para cliente ${customer.id}:`, {
            tipoResultado: typeof decryptedMercadoPagoCredsString,
            tieneContenido: typeof decryptedMercadoPagoCredsString === 'string' && decryptedMercadoPagoCredsString.length > 0,
            longitudResultado: typeof decryptedMercadoPagoCredsString === 'string' ? decryptedMercadoPagoCredsString.length : 'No es string valido'
          });

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
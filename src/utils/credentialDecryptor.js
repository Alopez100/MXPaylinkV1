// src/utils/credentialDecryptor.js
// Responsabilidad: Desencriptar cadenas de credenciales de proveedores de pago almacenadas en la base de datos,
// manejando tanto el formato legacy (cadena directa) como el nuevo (objeto JSON con propiedad 'encrypted').
// Lógica:
// 1. Recibe el valor almacenado en la base de datos (puede ser string o { encrypted: '...' }).
// 2. Determina el formato.
// 3. Extrae la cadena encriptada.
// 4. Llama a la función decrypt.
// 5. Intenta parsear el resultado como JSON.
// 6. Si falla el JSON, intenta convertir desde formato legacy 'client_id:secret'.
// 7. Retorna el objeto { client_id, secret } o null si falla.

const logger = require('./logger'); // Importamos el logger
const { decrypt } = require('./encryptionUtils'); // Importamos la función de desencriptación
const { convertFromLegacyFormat } = require('./encryptionUtils'); // Importamos la función de conversión legacy, asumiendo que está allí o la movemos

/**
 * Desencripta credenciales de un proveedor de pago.
 * @param {string|Object} credsFromDB - El valor almacenado en la base de datos (p. ej., paypal_creds).
 * @param {string} providerName - El nombre del proveedor para logs (e.g., 'PayPal', 'Conekta', 'MercadoPago').
 * @param {string} customerId - El ID del cliente para logs.
 * @returns {Object|null} - El objeto { client_id, secret } o null si falla.
 */
const decryptProviderCredentials = (credsFromDB, providerName, customerId) => {
  logger.debug(`[CREDENTIAL DECRYPTOR] Iniciando desencriptación para ${providerName} cliente ${customerId}. Tipo de valor en DB: ${typeof credsFromDB}`);

  let encryptedString = null;

  // --- Determinar formato y extraer cadena encriptada ---
  if (typeof credsFromDB === 'object' && credsFromDB.encrypted) {
    logger.debug(`[CREDENTIAL DECRYPTOR] Formato nuevo detectado para ${providerName} cliente ${customerId}.`);
    encryptedString = credsFromDB.encrypted;
  } else if (typeof credsFromDB === 'string') {
    logger.debug(`[CREDENTIAL DECRYPTOR] Formato legacy (cadena) detectado para ${providerName} cliente ${customerId}.`);
    encryptedString = credsFromDB;
  } else {
    logger.error(`[CREDENTIAL DECRYPTOR] Formato inesperado para credenciales de ${providerName} en DB cliente ${customerId}.`);
    return null; // Retorna null indicando fallo
  }

  // --- Desencriptar ---
  let decryptedCredsString = null;
  try {
    decryptedCredsString = decrypt(encryptedString);
    logger.debug(`[CREDENTIAL DECRYPTOR] Resultado de decrypt ${providerName} para cliente ${customerId}:`, {
      tipoResultado: typeof decryptedCredsString,
      tieneContenido: typeof decryptedCredsString === 'string' && decryptedCredsString.length > 0,
      longitudResultado: typeof decryptedCredsString === 'string' ? decryptedCredsString.length : 'No es string valido'
    });
  } catch (decryptError) {
    logger.error(`[CREDENTIAL DECRYPTOR] Error al desencriptar las credenciales de ${providerName} para cliente ${customerId}:`, decryptError.message);
    return null; // Retorna null indicando fallo
  }

  // --- Parsear o convertir el resultado desencriptado ---
  if (!decryptedCredsString) {
    logger.error(`[CREDENTIAL DECRYPTOR] No se pudo desencriptar las credenciales de ${providerName} para cliente ${customerId}. Valor en DB (después de extracción): ${encryptedString}`);
    return null; // Retorna null indicando fallo
  }

  let parsedCreds = null;
  try {
    // Intentar parsear como JSON
    parsedCreds = JSON.parse(decryptedCredsString);
    logger.debug(`[CREDENTIAL DECRYPTOR] Credenciales ${providerName} desencriptadas y parseadas como JSON para cliente ${customerId}.`);
  } catch (jsonParseError) {
    logger.warn(`[CREDENTIAL DECRYPTOR] Error al parsear credenciales ${providerName} como JSON para cliente ${customerId}:`, jsonParseError.message);
    logger.debug(`[CREDENTIAL DECRYPTOR] Intentando formato legacy 'client_id:secret' para cliente ${customerId}.`);
    // Si falla el parseo JSON, intentar formato legacy
    parsedCreds = convertFromLegacyFormat(decryptedCredsString);
    if (parsedCreds) {
      logger.info(`[CREDENTIAL DECRYPTOR] Credenciales ${providerName} convertidas desde formato legacy para cliente ${customerId}.`);
    } else {
      logger.error(`[CREDENTIAL DECRYPTOR] No se pudo interpretar las credenciales ${providerName} desencriptadas para cliente ${customerId}. Formato no válido.`);
      return null; // Retorna null indicando fallo
    }
  }

  logger.debug(`[CREDENTIAL DECRYPTOR] Credenciales ${providerName} procesadas exitosamente para cliente ${customerId}.`);
  return parsedCreds; // Retorna el objeto { client_id, secret } o equivalente
};

module.exports = {
  decryptProviderCredentials
};
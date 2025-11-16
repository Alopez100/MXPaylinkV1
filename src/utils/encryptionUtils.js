// src/utils/encryptionUtils.js
const crypto = require('crypto');
const logger = require('./logger'); // Asegúrate de que la ruta sea correcta

// Obtener la clave de encriptación desde las variables de entorno
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// >>>>>>>> NUEVA VALIDACIÓN Y MANEJO DE FALLBACK <<<<<<<<<
// Validar que la clave exista y tenga la longitud correcta (32 bytes para AES-256)
if (!ENCRYPTION_KEY) {
  logger.error('[ENCRYPTION UTILS] ENCRYPTION_KEY no definida en las variables de entorno.');
  // Opcional: generar una clave temporal o detener la aplicación si es crítica
  // process.exit(1); // Descomentar si se quiere detener la app sin clave
} else if (Buffer.byteLength(ENCRYPTION_KEY, 'utf8') !== 32) {
  logger.error('[ENCRYPTION UTILS] ENCRYPTION_KEY no tiene 32 bytes. La encriptación/desencriptación no funcionará correctamente.');
  logger.error(`[ENCRYPTION UTILS] Longitud actual: ${Buffer.byteLength(ENCRYPTION_KEY, 'utf8')} bytes.`);
  // Opcional: generar una clave temporal o detener la aplicación si es crítica
  // process.exit(1); // Descomentar si se quiere detener la app con clave incorrecta
} else {
  logger.info('[ENCRYPTION UTILS] Clave de encriptación cargada y válida (32 bytes).');
}
// >>>>>>>> FIN NUEVA VALIDACIÓN Y MANEJO DE FALLBACK <<<<<<<<<

// >>>>>>>> NUEVO: Manejo de clave por defecto (solo para desarrollo) <<<<<<<<<
// Usar una clave por defecto si no está definida en entorno de desarrollo
const isUsingDefaultKey = !ENCRYPTION_KEY;
if (isUsingDefaultKey) {
  // Generar una clave aleatoria (solo para desarrollo, no para producción)
  ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex'); // O puedes usar una clave fija para desarrollo
  // Asegúrate de que la clave fija tenga exactamente 32 bytes si decides usar una
  // Ej: ENCRYPTION_KEY = '4b163d9ef0a2e5d2c36568bc95142b6a4b163d9ef0a2e5d2c36568bc95142b6a';
  logger.warn(`[ENCRYPTION UTILS] Clave de encriptación por defecto generada (solo para desarrollo): ${ENCRYPTION_KEY.substring(0, 10)}...`); // Mostrar solo parte por seguridad
}
// >>>>>>>> FIN NUEVO: Manejo de clave por defecto <<<<<<<<<

/**
 * Encripta un string de texto plano.
 * @param {string} text - El texto plano a encriptar.
 * @returns {string|null} - El texto encriptado en formato 'iv_hex:encrypted_hex' o null si hay error.
 */
function encrypt(text) {
  // Si la clave por defecto está en uso, podría ser útil loguearlo para debugging
  if (isUsingDefaultKey) {
    logger.warn('[ENCRYPTION UTILS] ADVERTENCIA: Se está usando una clave de encriptación por defecto. ¡Esto es inseguro en producción!');
  }

  if (!ENCRYPTION_KEY) {
    logger.error('[ENCRYPTION UTILS] No se puede encriptar: ENCRYPTION_KEY no está definida.');
    return null; // Devolver null indica fallo
  }

  try {
    const iv = crypto.randomBytes(16); // Vector de inicialización
    // --- CORREGIDO: Usar createCipheriv en lugar de createCipher ---
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    // IMPORTANTE: Si el sistema anterior usaba padding automático (que es el padrón para CBC),
    // debemos asegurarlo aquí también.
    cipher.setAutoPadding(true);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Devolver IV y texto encriptado separados por ':'
    return iv.toString('hex') + ':' + encrypted;
  } catch (encryptError) {
    logger.error('[ENCRYPTION UTILS] Error al encriptar:', { error: encryptError.message });
    return null; // Devolver null indica fallo
  }
}

/**
 * Desencripta un string de texto encriptado previamente por esta función.
 * @param {string} encryptedText - El texto encriptado en formato 'iv_hex:encrypted_hex'.
 * @returns {string|null} - El texto desencriptado o null si hay error.
 */
function decrypt(encryptedText) {
  // Si la clave por defecto está en uso, podría ser útil loguearlo para debugging
  if (isUsingDefaultKey) {
    logger.warn('[ENCRYPTION UTILS] ADVERTENCIA: Se está usando una clave de desencriptación por defecto. ¡Esto es inseguro en producción!');
  }

  if (!ENCRYPTION_KEY) {
    logger.error('[ENCRYPTION UTILS] No se puede desencriptar: ENCRYPTION_KEY no está definida.');
    return null; // Devolver null indica fallo
  }

  try {
    // Dividir el texto encriptado en IV y datos encriptados
    const textParts = encryptedText.split(':');
    if (textParts.length !== 2) {
      logger.error('[ENCRYPTION UTILS] Formato de texto encriptado inválido (no contiene un solo ":").', { encryptedText });
      return null; // Devolver null indica fallo
    }

    const ivHex = textParts[0];
    const encryptedHex = textParts[1];

    const iv = Buffer.from(ivHex, 'hex'); // Convertir IV de hexadecimal a Buffer
    const encryptedBuffer = Buffer.from(encryptedHex, 'hex'); // Convertir datos encriptados de hexadecimal a Buffer

    // --- CORREGIDO: Crear el decipher usando createDecipheriv ---
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    // Asegurar que el padding se maneje (debe coincidir con el usado en encriptar)
    decipher.setAutoPadding(true);

    // Actualizar el buffer de datos desencriptados
    let decrypted = decipher.update(encryptedBuffer);
    // Finalizar el proceso de desencriptación
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8'); // Asegurar codificación UTF-8 del texto resultante
  } catch (decryptError) {
    logger.error('[ENCRYPTION UTILS] Error al desencriptar:', { error: decryptError.message });
    return null; // Devolver null indica fallo
  }
}

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

module.exports = {
  encrypt,
  decrypt,
  convertFromLegacyFormat // Añadir esta línea para exportar la función
};
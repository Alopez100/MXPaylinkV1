// src/utils/phoneNormalizer.js
const logger = require('./logger'); // Asegúrate de que la ruta sea correcta

/**
 * Normaliza un número de teléfono a un formato estándar (E.164 sin +) para números mexicanos.
 * Formatos aceptados:
 * - 10 dígitos locales: XXXXXXXXXX -> 52XXXXXXXXXX
 * - 11 dígitos con prefijo 1: 1XXXXXXXXXX -> 52XXXXXXXXXX
 * - 12 dígitos con código país 52: 52XXXXXXXXXX -> 52XXXXXXXXXX
 * - 13 dígitos con código país 52 y prefijo 1: 521XXXXXXXXXX -> 52XXXXXXXXXX
 * - Con signo +: +52... (se aplica la lógica anterior después de quitar el +)
 * @param {string} phoneNumber - El número de teléfono a normalizar.
 * @returns {string|null} - El número normalizado (52 + 10 dígitos) o null si es inválido.
 */
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return null;
  }

  // 1. Eliminar todos los caracteres no numéricos excepto el +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  logger.debug(`[NORMALIZE PHONE] Número limpiado: ${cleaned} (original: ${phoneNumber})`);

  // 2. Manejar el signo +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
    logger.debug(`[NORMALIZE PHONE] Número después de quitar +: ${cleaned}`);
  }

  // 3. Validar longitud básica para números mexicanos potenciales
  // Aceptamos longitudes entre 10 y 13 dígitos después de la limpieza
  if (cleaned.length < 10 || cleaned.length > 13) {
    logger.warn(`[NORMALIZE PHONE] Número con longitud inválida (${cleaned.length} dígitos): ${phoneNumber}`);
    return null;
  }

  // 4. Aplicar lógica específica de normalización para México
  let normalized = null;

  switch (cleaned.length) {
    case 10:
      // Formato local: XXXXXXXXXX
      normalized = '52' + cleaned;
      logger.debug(`[NORMALIZE PHONE] Formato 10 dígitos convertido: ${normalized}`);
      break;
    case 11:
      // Posible formato con prefijo 1: 1XXXXXXXXXX
      if (cleaned.startsWith('1')) {
        normalized = '52' + cleaned.substring(1);
        logger.debug(`[NORMALIZE PHONE] Formato 11 dígitos (prefijo 1) convertido: ${normalized}`);
      } else {
        logger.warn(`[NORMALIZE PHONE] Número de 11 dígitos no comienza con 1: ${phoneNumber}`);
        return null; // Formato no reconocido
      }
      break;
    case 12:
      // Formato con código país: 52XXXXXXXXXX
      if (cleaned.startsWith('52')) {
        // Asumimos que los siguientes 10 dígitos son el número local
        normalized = cleaned; // Ya está en el formato deseado
        logger.debug(`[NORMALIZE PHONE] Formato 12 dígitos (52) válido: ${normalized}`);
      } else {
        logger.warn(`[NORMALIZE PHONE] Número de 12 dígitos no comienza con 52: ${phoneNumber}`);
        return null; // Código de país no reconocido
      }
      break;
    case 13:
      // Formato con código país y prefijo 1: 521XXXXXXXXXX
      if (cleaned.startsWith('521')) {
        // Eliminar el '1' y quedarse con 52 + 10 dígitos locales
        normalized = '52' + cleaned.substring(3);
        logger.debug(`[NORMALIZE PHONE] Formato 13 dígitos (521) convertido: ${normalized}`);
      } else {
        logger.warn(`[NORMALIZE PHONE] Número de 13 dígitos no comienza con 521: ${phoneNumber}`);
        return null; // Formato no reconocido
      }
      break;
    default:
      // Este caso no debería alcanzarse por la validación de longitud, pero por si acaso
      logger.warn(`[NORMALIZE PHONE] Longitud no manejada (${cleaned.length} dígitos): ${phoneNumber}`);
      return null;
  }

  // 5. Validación final: debe tener exactamente 12 dígitos (52 + 10 dígitos locales)
  if (normalized && normalized.length === 12 && normalized.startsWith('52')) {
    const localPart = normalized.substring(2);
    if (localPart.length === 10) {
      logger.info(`[NORMALIZE PHONE] Número normalizado exitosamente: ${phoneNumber} -> ${normalized}`);
      return normalized;
    }
  }

  logger.warn(`[NORMALIZE PHONE] Número no pudo ser normalizado a 12 dígitos (52+10): ${phoneNumber} -> ${normalized}`);
  return null;
}

module.exports = {
  normalizePhoneNumber
};
// src/services/commandExtractor.js
// Responsabilidad: Interpretar el texto del mensaje para extraer los datos necesarios (cliente final, monto, concepto).
// Lógica (Simplificada para V1):
//   - Recibir messageText.
//   - Usar expresiones regulares o lógica simple para identificar monto, concepto, nombre_cliente_final, email_cliente_final.
//   - Validar que los datos requeridos estén presentes.
//   - Devolver un objeto con { amount, concept, finalCustomerName, finalCustomerEmail } o null si falla.

const logger = require('../utils/logger'); // Importamos el logger

// Comando esperado para iniciar la solicitud de pago
// Ejemplo: PAGO 500.00 Consultoría Juan Pérez juan.perez@example.com
// Opcional: PAGO 500 Consultoría Juan Pérez juan.perez@example.com
const PAYMENT_COMMAND = 'PAGO'; // Puede ser configurable desde .env

/**
 * Extrae datos de pago del mensaje de texto.
 * @param {string} messageText - El texto del mensaje recibido.
 * @returns {Object|null} - Un objeto con { amount, concept, finalCustomerName, finalCustomerEmail } o null si falla.
 */
const extractPaymentData = async (messageText) => {
    logger.debug(`[COMMAND EXTRACTOR] Intentando extraer datos de: "${messageText}"`);

    // Normalizar el mensaje para facilitar la comparación
    const normalizedMessage = messageText.trim();

    if (!normalizedMessage.toUpperCase().startsWith(PAYMENT_COMMAND)) {
        logger.warn(`[COMMAND EXTRACTOR] Mensaje no comienza con el comando esperado '${PAYMENT_COMMAND}'. Mensaje: "${messageText}"`);
        return null;
    }

    // Dividir el mensaje en partes (palabras separadas por espacios)
    // Ejemplo: ["PAGO", "500.00", "Consultoría", "Juan", "Pérez", "juan.perez@example.com"]
    const parts = normalizedMessage.split(/\s+/);

    if (parts.length < 5) {
        logger.warn(`[COMMAND EXTRACTOR] Mensaje tiene menos de 5 partes, insuficiente para extraer datos. Mensaje: "${messageText}"`);
        return null;
    }

    // Extraer datos basados en la posición (esto puede mejorarse con lógica más robusta)
    // parts[0] = "PAGO"
    const rawAmount = parts[1];
    // parts[2] = Concepto (puede tener espacios, se maneja después)
    const rawEmail = parts[parts.length - 1]; // El email es la última parte
    const rawNameParts = parts.slice(2, parts.length - 1); // El nombre está entre el monto y el email
    const rawConcept = rawNameParts.join(' '); // El concepto es lo que queda entre el monto y el nombre

    // 1. Extraer y validar el monto
    // Expresión regular para capturar números con o sin decimales, posiblemente precedidos por '$'
    const amountRegex = /^\$?(\d+(?:\.\d{1,2})?)$/;
    const amountMatch = rawAmount.match(amountRegex);

    if (!amountMatch) {
        logger.warn(`[COMMAND EXTRACTOR] No se pudo extraer un monto válido de: "${rawAmount}". Mensaje: "${messageText}"`);
        return null;
    }

    const amount = parseFloat(amountMatch[1]);
    if (isNaN(amount) || amount <= 0) {
        logger.warn(`[COMMAND EXTRACTOR] Monto extraído no es un número válido o es <= 0: ${amount}. Mensaje: "${messageText}"`);
        return null;
    }

    // 2. Extraer y validar el concepto
    // Tomamos el concepto como el texto entre el monto y el nombre del cliente
    // Se asume que no hay espacios en el monto o email que lo compliquen más.
    // Ej: "PAGO 500 Concepto con espacios Juan Pérez juan@example.com"
    // parts = ["PAGO", "500", "Concepto", "con", "espacios", "Juan", "Pérez", "juan@example.com"]
    // rawNameParts = ["Concepto", "con", "espacios"] -> rawConcept = "Concepto con espacios"
    // rawNameParts = ["Juan", "Pérez"]
    const concept = rawConcept.trim();
    if (!concept) {
        logger.warn(`[COMMAND EXTRACTOR] No se pudo extraer un concepto válido. Mensaje: "${messageText}"`);
        return null;
    }

    // 3. Extraer y validar el nombre del cliente final
    const finalCustomerName = rawNameParts.join(' ').trim();
    if (!finalCustomerName) {
        logger.warn(`[COMMAND EXTRACTOR] No se pudo extraer un nombre de cliente final válido. Mensaje: "${messageText}"`);
        return null;
    }

    // 4. Extraer y validar el email del cliente final
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawEmail)) {
        logger.warn(`[COMMAND EXTRACTOR] Email extraído no es válido: "${rawEmail}". Mensaje: "${messageText}"`);
        return null;
    }
    const finalCustomerEmail = rawEmail;

    logger.info(`[COMMAND EXTRACTOR] Datos extraídos exitosamente: Monto: ${amount}, Concepto: "${concept}", Cliente Final: "${finalCustomerName}", Email: "${finalCustomerEmail}"`);

    // Devolver el objeto con los datos extraídos
    return {
        amount: amount,
        concept: concept,
        finalCustomerName: finalCustomerName,
        finalCustomerEmail: finalCustomerEmail
    };
};

module.exports = {
    extractPaymentData // Exportamos la función principal
};
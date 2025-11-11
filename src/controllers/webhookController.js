// C:\Users\MotoTaxi\Documents\MXPaylink\V1\src\controllers\webhookController.js
// Responsabilidad: Recibir la solicitud POST de 360Dialog (verificación y mensajes entrantes).
// Entrada: req.body (mensaje entrante de WhatsApp).
// Salida: Extrae from (teléfono) y messageText.
// Siguiente Paso: Llama al MessageProcessor.

const logger = require('../utils/logger'); // Importamos el logger
const messageProcessor = require('../processors/messageProcessor'); // Importamos el procesador

// Función para manejar la verificación del webhook (GET)
const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.debug(`[WHATSAPP WEBHOOK] Solicitud de verificación recibida. Mode: ${mode}, Token: ${token ? 'Present' : 'Missing'}`);

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        logger.info('[WHATSAPP WEBHOOK] Verificación exitosa.');
        res.status(200).send(challenge);
    } else {
        logger.warn('[WHATSAPP WEBHOOK] Verificación fallida. Mode o Token inválido.');
        res.sendStatus(403);
    }
};

// Función para manejar el mensaje entrante de WhatsApp (POST)
const handleIncomingMessage = async (req, res) => {
    logger.debug('[WHATSAPP WEBHOOK] Solicitud POST recibida.');

    // Extrae el cuerpo de la solicitud
    const { body } = req;

    // Verifica que el cuerpo tenga la estructura esperada de 360Dialog
    if (!body || !body.entry || !Array.isArray(body.entry) || body.entry.length === 0) {
        logger.warn('[WHATSAPP WEBHOOK] Estructura de entrada inválida o vacía.', { body });
        return res.status(400).json({ error: 'Invalid or empty webhook structure' });
    }

    const entry = body.entry[0]; // Tomamos la primera entrada

    if (!entry.changes || !Array.isArray(entry.changes) || entry.changes.length === 0) {
        logger.warn('[WHATSAPP WEBHOOK] No se encontraron cambios en la entrada.', { entry });
        return res.status(400).json({ error: 'No changes found in entry' });
    }

    const change = entry.changes[0]; // Tomamos el primer cambio

    // Verifica que el cambio sea para el campo "messages"
    if (change.field !== 'messages') {
        logger.info(`[WHATSAPP WEBHOOK] Cambio recibido para el campo '${change.field}', ignorando.`);
        // Responder con OK para que 360Dialog no reintente este evento
        return res.status(200).json({ status: 'Webhook received for non-messages field' });
    }

    const value = change.value; // Extraemos el valor del cambio

    if (!value.messages || !Array.isArray(value.messages) || value.messages.length === 0) {
        logger.warn('[WHATSAPP WEBHOOK] No se encontraron mensajes en el valor del cambio.', { value });
        return res.status(400).json({ error: 'No messages found in change value' });
    }

    const messageData = value.messages[0]; // Tomamos el primer mensaje
    const from = messageData.from;
    const messageText = messageData.text ? messageData.text.body : null;

    if (from && messageText) {
        logger.info(`[WHATSAPP WEBHOOK] Mensaje recibido de: ${from}. Texto: "${messageText}"`);
        // Llama al MessageProcessor para determinar el tipo de cliente y manejarlo
        await messageProcessor.processMessage(from, messageText);
        res.status(200).json({ status: 'Mensaje recibido y procesado.' });
    } else {
        logger.warn('[WHATSAPP WEBHOOK] Mensaje incompleto o sin texto.', { messageData });
        res.status(400).json({ error: 'Mensaje incompleto o sin texto.' });
    }
};

module.exports = {
    verifyWebhook,
    handleIncomingMessage
};
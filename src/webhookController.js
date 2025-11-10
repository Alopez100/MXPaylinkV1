// src/controllers/webhookController.js
// Responsabilidad: Recibir la solicitud POST de 360Dialog.
// Entrada: req.body (mensaje entrante).
// Salida: Extrae from (teléfono) y messageText.
// Siguiente Paso: Llama al MessageProcessor.

const logger = require('../utils/logger'); // Importamos un logger básico y configurable
const messageProcessor = require('../processors/messageProcessor'); // Importamos el procesador

// Función para simular la verificación del webhook (GET)
const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Simplemente verifica que el modo sea 'subscribe' y el token coincida
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        logger.info('[WHATSAPP WEBHOOK] Verificación exitosa.');
        res.status(200).send(challenge);
    } else {
        logger.warn('[WHATSAPP WEBHOOK] Verificación fallida.');
        res.sendStatus(403);
    }
};

// Función para manejar el mensaje entrante (POST)
const handleIncomingMessage = async (req, res) => {
    logger.debug('[WHATSAPP WEBHOOK] Solicitud POST recibida.');

    // Extrae el cuerpo de la solicitud
    const { body } = req;

    // Busca el mensaje dentro de la estructura de 360Dialog
    // Asumimos que el cuerpo tiene la forma:
    // { messages: [ { from: "...", text: { body: "..." } } ], ... }
    const messageData = body.messages && body.messages[0];

    if (messageData) {
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
    } else {
        logger.warn('[WHATSAPP WEBHOOK] No se encontró el objeto message en la solicitud.', { body });
        res.status(400).json({ error: 'No se encontró el objeto message.' });
    }
};

module.exports = {
    verifyWebhook,
    handleIncomingMessage
};
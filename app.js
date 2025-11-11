// C:\Users\MotoTaxi\Documents\MXPaylink\V1\app.js
// Archivo principal para la aplicación Express de MXPaylink V1
// Este archivo está diseñado para ser ejecutado directamente en Render.

const express = require('express'); // Importar Express
const path = require('path'); // Importar path para manejo de rutas
const logger = require('./src/utils/logger'); // Importar nuestro logger centralizado

// Importar los controladores que creamos
const { verifyWebhook, handleIncomingMessage } = require('./src/controllers/webhookController'); // Solo para WhatsApp
const { handleWebhook: handlePayPalWebhook } = require('./src/controllers/paypalWebhookController'); // Solo para PayPal

// Crear la aplicación Express
const app = express();

// --- MIDDLEWARES ---

// Middleware para parsear el cuerpo de solicitudes JSON
// Importante para recibir mensajes de 360Dialog y webhooks (excepto para verificación de webhook PayPal que necesita rawBody)
app.use(express.json());

// Middleware para parsear el cuerpo como texto plano (necesario para la verificación de webhook de PayPal)
// Este middleware intercepta la ruta específica del webhook de PayPal
app.use('/webhook/paypal', express.text({ type: 'application/json' }));

// Middleware para parsear el cuerpo como JSON para otras rutas que no sean el webhook de PayPal
// Este se ejecutará después del middleware específico de PayPal para otras rutas
app.use((req, res, next) => {
  // Si no es la ruta de webhook de PayPal, usamos el parser JSON estándar
  if (req.path !== '/webhook/paypal') {
    express.json()(req, res, next);
  } else {
    // Si es la ruta de webhook de PayPal, el body ya está como texto plano (rawBody)
    // Debemos parsearlo manualmente aquí antes de que llegue al controlador
    if (req.headers['content-type'] === 'application/json' && typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
        logger.debug('[APP] Body del webhook de PayPal parseado a JSON.');
      } catch (error) {
        logger.error('[APP] Error al parsear el body del webhook de PayPal:', error.message);
        return res.status(400).send('Invalid JSON in PayPal webhook body');
      }
    }
    next();
  }
});

// --- RUTAS ---

// Ruta para la verificación y manejo de mensajes de WhatsApp (360Dialog)
// GET para verificación
app.get('/webhook/whatsapp', verifyWebhook);
// POST para mensajes entrantes
app.post('/webhook/whatsapp', handleIncomingMessage);

// Ruta para el webhook de PayPal
// POST para eventos de PayPal
app.post('/webhook/paypal', handlePayPalWebhook);

// Ruta raíz (opcional, para verificar que el servidor está corriendo)
app.get('/', (req, res) => {
  res.status(200).json({ message: 'MXPaylink V1 Backend is running!' });
});

// --- MANEJO DE ERRORES GLOBAL (Opcional pero recomendado) ---
app.use((err, req, res, next) => {
  logger.error('Error no manejado en Express:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// --- INICIAR EL SERVIDOR ---
// Obtener el puerto de la variable de entorno PORT (proporcionada por Render) o usar 10000 como fallback
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => { // Escuchar en '0.0.0.0' para que Render pueda acceder al servidor
  logger.info(`MXPaylink V1 Server listening on port ${PORT}`);
});

module.exports = app; // Exportar la app por si se necesita en pruebas o módulos externos
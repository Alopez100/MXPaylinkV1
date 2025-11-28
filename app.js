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

// Middleware para parsear el cuerpo como texto plano solo para la ruta específica del webhook de PayPal
// Esto permite que el controlador de PayPal reciba el cuerpo como texto plano inicialmente si es necesario,
// y lo parsee manualmente si lo requiere.
app.use('/webhook/paypal', express.text({ type: 'application/json' }));

// Middleware para parsear el cuerpo como JSON para todas las demás rutas
// Este middleware se ejecutará para rutas distintas a '/webhook/paypal'.
// Para '/webhook/paypal', este middleware no se ejecutará gracias al middleware anterior.
app.use(express.json());

// Middleware genérico para rutas específicas que requieren manejo adicional del body (en este caso, PayPal)
// Este middleware se ejecuta *después* de los anteriores.
// Si la ruta es '/webhook/paypal' y el body es texto plano (string), lo parseamos a JSON aquí.
app.use((req, res, next) => {
  if (req.path === '/webhook/paypal' && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
      logger.debug('[APP] Body del webhook de PayPal parseado a JSON.');
    } catch (error) {
      logger.error('[APP] Error al parsear el body del webhook de PayPal:', error.message);
      return res.status(400).send('Invalid JSON in PayPal webhook body');
    }
  }
  next(); // Continuar con el siguiente middleware o ruta
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

// --- AÑADIDO: Ruta para Health Check de Render ---
app.get('/healthz', (req, res) => {
  // Puedes hacer comprobaciones básicas aquí si lo deseas (e.g., ping a la DB)
  // Para un inicio, simplemente responder OK es suficiente.
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
// --- FIN AÑADIDO ---

// --- MANEJO DE ERRORES GLOBAL (Opcional pero recomendado) ---
app.use((err, req, res, next) => {
  logger.error('Error no manejado en Express:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// --- INICIAR EL SERVIDOR ---
// Obtener el puerto de la variable de entorno PORT (proporcionada por Render) o usar 10000 como fallback
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => { // Escuchar en '0.0.0.0' para que Render pueda acceder al servidor
  logger.info('=== MARCADOR DE DESPLIEGUE: Versión 28Nov2025_02 ==='); // <--- MARCADOR AÑADIDO
  logger.info(`MXPaylink V1 Server listening on port ${PORT}`);
});

module.exports = app; // Exportar la app por si se necesita en pruebas o módulos externos
//Nueva linea para forzar build.

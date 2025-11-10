// src/utils/logger.js
// Responsabilidad: Proporcionar funciones de logging configurables.
// Se pueden activar/desactivar logs por módulo o nivel usando variables de entorno.

// Definir niveles de log
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Obtener nivel de log desde .env, por defecto INFO
const currentLogLevel = process.env.LOG_LEVEL || 'INFO';
const logLevelValue = LOG_LEVELS[currentLogLevel.toUpperCase()] ?? LOG_LEVELS.INFO;

// Función para determinar si un log debe imprimirse según el nivel
function shouldLog(level) {
    return LOG_LEVELS[level.toUpperCase()] <= logLevelValue;
}

// Función para obtener timestamp
function getTimestamp() {
    return new Date().toISOString();
}

// Funciones de log específicas por nivel
function log(level, message, context = null) {
    if (shouldLog(level)) {
        const timestamp = getTimestamp();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        if (context !== null) {
            console.log(logMessage, context);
        } else {
            console.log(logMessage);
        }
    }
}

// Funciones exportadas
module.exports = {
    error: (message, context) => log('ERROR', message, context),
    warn: (message, context) => log('WARN', message, context),
    info: (message, context) => log('INFO', message, context),
    debug: (message, context) => log('DEBUG', message, context),
    // Opcional: Función para verificar si un log específico está activo
    isDebugEnabled: () => shouldLog('DEBUG'),
    isInfoEnabled: () => shouldLog('INFO'),
    // ... otras funciones si es necesario
};
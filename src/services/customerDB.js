// src/services/customerDB.js
// Responsabilidad: Interactuar con la base de datos de clientes para encontrar registros.
// Este módulo actúa como una interfaz simple para consultas de clientes.
// Lógica:
//   - findCustomerByPhoneNumber: Busca un cliente por su número de teléfono.

const logger = require('../utils/logger'); // Importamos el logger

// Simulación de base de datos local (solo para pruebas iniciales)
// En una implementación real, aquí se usaría Sequelize o una librería de base de datos.
const mockDatabase = {
    // Ejemplo de cliente activo
    '5213311296199': {
        id: 1,
        phone: '5213311296199', // Número de ejemplo
        email: 'clienteactivo@example.com',
        service_status: 'activo', // o 'vencido', 'suspendido'
        paypal_creds: { client_id: 'fake_client_id', secret: 'fake_secret' }, // Credenciales simuladas
        created_at: new Date(),
        updated_at: new Date()
    }
    // Agrega más clientes simulados aquí si es necesario para pruebas
    // 'otro_numero': { ... },
};

/**
 * Busca un cliente en la base de datos por su número de teléfono.
 * @param {string} phoneNumber - El número de teléfono a buscar.
 * @returns {Object|null} - El objeto cliente si se encuentra, o null si no.
 */
const findCustomerByPhoneNumber = async (phoneNumber) => {
    logger.debug(`[CUSTOMER DB] Buscando cliente con teléfono: ${phoneNumber} en la base de datos.`);

    // Simula una operación asincrónica (por ejemplo, una consulta a la base de datos)
    await new Promise(resolve => setTimeout(resolve, 10));

    // Busca en la "base de datos simulada"
    const customer = mockDatabase[phoneNumber] || null;

    if (customer) {
        logger.info(`[CUSTOMER DB] Cliente encontrado para teléfono: ${phoneNumber}. ID: ${customer.id}`);
        // En una implementación real, aquí se devolvería el modelo de Sequelize o un objeto mapeado.
        // Devolvemos una copia para evitar modificaciones accidentales del mock.
        return { ...customer };
    } else {
        logger.info(`[CUSTOMER DB] Cliente NO encontrado para teléfono: ${phoneNumber}.`);
        return null;
    }
};

module.exports = {
    findCustomerByPhoneNumber // Exportamos la función de búsqueda
};
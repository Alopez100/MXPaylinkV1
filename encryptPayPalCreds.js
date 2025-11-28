// encryptPayPalCreds.js
// Asegúrate de tener un archivo .env local con la clave correcta o define la clave aquí.
require('dotenv').config(); // Si usas .env
const crypto = require('crypto');

// Define la clave de encriptación aquí o cárgala desde process.env
// Asegúrate que sea exactamente sXkZvYpLqWnRtMhBcVjDfGzAeSdQwEiU
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'sXkZvYpLqWnRtMhBcVjDfGzAeSdQwEiU';

// Tus credenciales reales de PayPal
const paypalCredsObject = {
    client_id: "AcC-KxCx0Ko6yOVVQ-J0rQyNFplTP3PQ7SeKMZcF9grxeIWaR3-zcMaZJTLlchFZKUBkURQcl8xe7nvg", // Reemplaza esto con tu Client ID real
    secret: "EG0DExh3C_CxCkblJ5hJ1m7d5phF5WsXP6rSbZvFXyhk7Fj59SeCsxJbzTTYKBNFN0ACsh5ggGdFyEw"     // Reemplaza esto con tu Secret real
};

// Convierte el objeto a una cadena JSON
const credsString = JSON.stringify(paypalCredsObject);
console.log("Cadena a encriptar:", credsString);

// Función de encriptación (copiada de encryptionUtils.js, adaptada)
function encrypt(text) {
    if (typeof text !== 'string') {
        console.error('[ENCRYPTION UTILS TEMP] El texto a encriptar no es una cadena válida.');
        return null;
    }

    if (!ENCRYPTION_KEY) {
        console.error('[ENCRYPTION UTILS TEMP] No se puede encriptar: ENCRYPTION_KEY no está definida.');
        return null;
    }

    // Asegúrate que la clave tenga 32 bytes
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'utf8');
    if (keyBuffer.length !== 32) {
        console.error(`[ENCRYPTION UTILS TEMP] La clave de encriptación debe tener 32 bytes, tiene ${keyBuffer.length} bytes. Clave: ${ENCRYPTION_KEY}`);
        return null;
    }

    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
        cipher.setAutoPadding(true); // Asegura padding PKCS#7

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Combina IV y datos encriptados
        const encryptedWithIv = iv.toString('hex') + ':' + encrypted;
        return encryptedWithIv;

    } catch (error) {
        console.error('[ENCRYPTION UTILS TEMP] Error al encriptar:', error.message);
        return null;
    }
}

// Encripta la cadena
const encryptedCreds = encrypt(credsString);

if (encryptedCreds) {
    console.log("\n--- RESULTADO ---");
    console.log("Cadena encriptada generada (sin comillas ni caracteres especiales):");
    console.log(encryptedCreds); // <-- Esta es la CADENA_ENCRIPTADA_FINAL que necesitas
    console.log("\nValor COMPLETO a insertar en la base de datos (formato JSON con clave 'encrypted'):");
    console.log(`{"encrypted": "${encryptedCreds}"}`);
    console.log("--- FIN RESULTADO ---");
} else {
    console.error("Falló la encriptación.");
}
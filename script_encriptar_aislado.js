// script_encriptar_aislado.js
// Este script no depende de process.env.ENCRYPTION_KEY
const crypto = require('crypto');

// Define la clave de encriptación explícitamente aquí
const clave = "sXkZvYpLqWnRtMhBcVjDfGzAeSdQwEiU";
// Asegúrate que tenga 32 bytes para AES-256
if (Buffer.byteLength(clave, 'utf8') !== 32) {
    console.error("Error: La clave debe tener exactamente 32 bytes para AES-256.");
    process.exit(1);
}

// Define tus credenciales reales de PayPal Sandbox (copiadas de la imagen)
const credencialesOriginales = {
  client_id: "AcC-KxCx0Ko6yOVVQ-J0rQyNFplTP3PQ7SeKMZcF9grxeIWaR3-zcMaZJTLlchFZKUBkURQcl8xe7nvg",
  secret: "EG99Ta06Hu4ddqIpHRTAu5-w-aMprprtqtHC2S5qBZytbLVcoY-ZPGVX9swbkFKTZ529oOifqG_JBU7w"
};

// Convierte el objeto a una cadena JSON
const credencialesString = JSON.stringify(credencialesOriginales);
console.log("Cadena JSON original:", credencialesString);

// --- Lógica de Encriptación Directa (Usando createCipheriv) ---
// Genera un IV aleatorio de 16 bytes (necesario para AES-CBC)
const iv = crypto.randomBytes(16);

// Crea el cifrador usando 'aes-256-cbc', la clave y el IV generado
const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(clave, 'utf8'), iv);
cipher.setAutoPadding(true); // Habilita el padding PKCS7

// Encripta la cadena JSON
let encrypted = cipher.update(credencialesString, 'utf8', 'hex');
encrypted += cipher.final('hex');

// Combina el IV (en hexadecimal) y los datos encriptados (también en hexadecimal), separados por ':'
const credencialesEncriptadas = `${iv.toString('hex')}:${encrypted}`;

// --- Fin de la Lógica de Encriptación ---

console.log("Credenciales encriptadas:", credencialesEncriptadas);
console.log("La encriptación se completó exitosamente.");
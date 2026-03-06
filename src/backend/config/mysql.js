const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Como adoptamos la arquitectura de API REST para la sincronización,
// la aplicación de escritorio ya no necesita conectarse por SSH a MySQL.
// Este archivo ahora solo se ejecutará de forma local dentro del servidor en la nube (VPS).
const dbServer = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'savater_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

function getPool() {
    if (!pool) {
        console.log('Inicializando Pool de conexiones a MySQL de forma directa...');
        pool = mysql.createPool(dbServer);
    }
    return pool;
}

// Exportamos el pool directamente para que sea consumido por los servicios y rutas
module.exports = getPool();
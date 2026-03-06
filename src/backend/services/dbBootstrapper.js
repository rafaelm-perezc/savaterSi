const pool = require('../config/mysql');
const db = require('../config/sqlite');
const jwt = require('jsonwebtoken');

const catalogTables = [
    'escalas_valorativas', 'periodos_academicos', 'usuarios', 'roles',
    'usuarios_roles', 'sedes', 'jornadas', 'grados', 'grupos',
    'estudiantes', 'matriculas', 'asignaturas', 'carga_academica', 'logros_competencias'
];

const isCloud = process.env.IS_CLOUD === 'true';
const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secreto_colegio_123';

function getAuthToken() {
    return jwt.sign({ origin: 'electron-client' }, JWT_SECRET, { expiresIn: '15m' });
}

// Lógica para descargar e insertar en lotes (Evita OOM)
async function downloadTableInChunks(tableName) {
    console.log(`[Bootstrapper Local] Descargando ${tableName} vía API (Paginado)...`);
    let offset = 0;
    const limit = 500;
    let hasMore = true;
    let totalInserted = 0;

    const headers = { 'Authorization': `Bearer ${getAuthToken()}` };

    while (hasMore) {
        const res = await fetch(`${CLOUD_API_URL}/sync/bootstrapper/pull/${tableName}?limit=${limit}&offset=${offset}`, { headers });
        if (!res.ok) throw new Error(`Error descargando la tabla ${tableName}`);
        
        const remoteData = await res.json();
        if (remoteData.length === 0) {
            hasMore = false;
            break;
        }

        // Transacción SQLite para escritura ultrarrápida
        await db.runAsync('BEGIN TRANSACTION');
        try {
            for (const row of remoteData) {
                const keys = Object.keys(row);
                const values = Object.values(row);
                const placeholders = keys.map(() => '?').join(', ');

                const query = `INSERT OR IGNORE INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
                await db.runAsync(query, values);
            }
            await db.runAsync('COMMIT');
        } catch(e) {
            await db.runAsync('ROLLBACK');
            throw e;
        }

        totalInserted += remoteData.length;
        offset += limit;
    }
    console.log(`[Bootstrapper Local] ${totalInserted} registros de ${tableName} insertados.`);
}

async function syncTableLocal(tableName) {
    const sqliteRows = await db.allAsync(`SELECT COUNT(*) as count FROM ${tableName}`);
    const sqliteCount = sqliteRows[0].count;

    // Consultar el conteo en la nube
    const res = await fetch(`${CLOUD_API_URL}/sync/bootstrapper/count/${tableName}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    
    if (!res.ok) {
        console.log(`[Bootstrapper Local] Nube inalcanzable, saltando tabla ${tableName}.`);
        return;
    }
    
    const { count: mysqlCount } = await res.json();

    if (sqliteCount === 0 && mysqlCount > 0) {
        await downloadTableInChunks(tableName);
    } else {
        console.log(`[Bootstrapper Local] ${tableName} verificada (Local: ${sqliteCount}, Nube: ${mysqlCount}).`);
    }
}

async function startCloningProcess() {
    if (isCloud) {
        console.log('--- MODO CLOUD: Inicializando base de datos MySQL ---');
        const initMySQL = require('../config/initMySQL');
        await initMySQL();
        return;
    }

    try {
        console.log('--- MODO LOCAL: INICIANDO BOOTSTRAP API ---');
        await db.initSQLite();

        for (const table of catalogTables) {
            await syncTableLocal(table);
        }
        console.log('--- BOOTSTRAP LOCAL COMPLETADO CON ÉXITO ---');
    } catch (error) {
        console.error('Error durante el bootstrap local:', error);
    }
}

module.exports = startCloningProcess;
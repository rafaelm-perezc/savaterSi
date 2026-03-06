const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../../../database/local.sqlite');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Inicialización de la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error abriendo la DB local SQLite', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite local.');
        // Habilitar la restricción de llaves foráneas a nivel de conexión
        db.run('PRAGMA foreign_keys = ON;', (err) => {
            if (err) console.error('Error habilitando llaves foráneas en SQLite', err);
        });
    }
});

// Convertimos db.run en promesa para facilitar el setup
db.runAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        this.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

db.allAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        this.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

async function initSQLite() {
    try {
        // Aseguramos nuevamente que las llaves foráneas estén activas para la creación
        await db.runAsync('PRAGMA foreign_keys = ON;');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS escalas_valorativas (
                id VARCHAR(36) PRIMARY KEY,
                nombre TEXT NOT NULL,
                rango_min REAL NOT NULL,
                rango_max REAL NOT NULL,
                descripcion TEXT,
                estado INTEGER DEFAULT 1
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS periodos_academicos (
                id VARCHAR(36) PRIMARY KEY,
                nombre TEXT NOT NULL,
                peso_porcentual REAL NOT NULL,
                fecha_inicio TEXT,
                fecha_fin TEXT,
                estado INTEGER DEFAULT 1
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id VARCHAR(36) PRIMARY KEY,
                identificacion TEXT UNIQUE NOT NULL,
                nombres TEXT NOT NULL,
                apellidos TEXT NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                estado INTEGER DEFAULT 1,
                creado_en TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS roles (
                id VARCHAR(36) PRIMARY KEY,
                nombre TEXT NOT NULL UNIQUE
            )
        `);

        // Tabla con llaves foráneas estrictas
        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS usuarios_roles (
                usuario_id VARCHAR(36),
                rol_id VARCHAR(36),
                sede_id VARCHAR(36),
                PRIMARY KEY (usuario_id, rol_id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS sedes (
                id VARCHAR(36) PRIMARY KEY,
                nombre TEXT NOT NULL,
                direccion TEXT,
                estado INTEGER DEFAULT 1
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS jornadas (
                id VARCHAR(36) PRIMARY KEY,
                nombre TEXT NOT NULL
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS grados (
                id VARCHAR(36) PRIMARY KEY,
                nombre TEXT NOT NULL,
                nivel TEXT
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS grupos (
                id VARCHAR(36) PRIMARY KEY,
                grado_id VARCHAR(36),
                sede_id VARCHAR(36),
                jornada_id VARCHAR(36),
                nombre TEXT NOT NULL,
                director_grupo_id VARCHAR(36),
                FOREIGN KEY (grado_id) REFERENCES grados(id),
                FOREIGN KEY (sede_id) REFERENCES sedes(id),
                FOREIGN KEY (jornada_id) REFERENCES jornadas(id),
                FOREIGN KEY (director_grupo_id) REFERENCES usuarios(id)
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS estudiantes (
                id VARCHAR(36) PRIMARY KEY,
                identificacion TEXT UNIQUE NOT NULL,
                nombres TEXT NOT NULL,
                apellidos TEXT NOT NULL,
                fecha_nacimiento TEXT,
                estado TEXT DEFAULT 'Activo'
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS matriculas (
                id VARCHAR(36) PRIMARY KEY,
                estudiante_id VARCHAR(36),
                grupo_id VARCHAR(36),
                anio_lectivo INTEGER NOT NULL,
                estado TEXT DEFAULT 'Matriculado',
                fecha_matricula TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
                FOREIGN KEY (grupo_id) REFERENCES grupos(id)
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS asignaturas (
                id VARCHAR(36) PRIMARY KEY,
                nombre TEXT NOT NULL,
                area_conocimiento TEXT,
                intensidad_horaria INTEGER DEFAULT 1,
                estado INTEGER DEFAULT 1
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS carga_academica (
                id VARCHAR(36) PRIMARY KEY,
                docente_id VARCHAR(36),
                asignatura_id VARCHAR(36),
                grupo_id VARCHAR(36),
                anio_lectivo INTEGER NOT NULL,
                FOREIGN KEY (docente_id) REFERENCES usuarios(id),
                FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id),
                FOREIGN KEY (grupo_id) REFERENCES grupos(id)
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS logros_competencias (
                id VARCHAR(36) PRIMARY KEY,
                asignatura_id VARCHAR(36),
                grado_id VARCHAR(36),
                periodo_id VARCHAR(36),
                descripcion TEXT NOT NULL,
                tipo TEXT DEFAULT 'Logro',
                FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id),
                FOREIGN KEY (grado_id) REFERENCES grados(id),
                FOREIGN KEY (periodo_id) REFERENCES periodos_academicos(id)
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS local_notes (
                id VARCHAR(36) PRIMARY KEY,
                sqlite_id VARCHAR(36),
                student_id VARCHAR(36),
                subject_id VARCHAR(36),
                note REAL,
                synced INTEGER DEFAULT 0,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES estudiantes(id),
                FOREIGN KEY (subject_id) REFERENCES asignaturas(id)
            )
        `);

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS logs_auditoria (
                id VARCHAR(36) PRIMARY KEY,
                tabla_afectada TEXT NOT NULL,
                registro_id VARCHAR(36) NOT NULL,
                accion TEXT NOT NULL,
                valor_anterior TEXT,
                valor_nuevo TEXT,
                usuario TEXT DEFAULT 'Sistema/Auto',
                fecha TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==========================================================
        // TRIGGERS (EL CORAZÓN DE LA SOLUCIÓN DEL PUNTO 3)
        // ==========================================================

        // 1. Trigger para emular ON UPDATE CURRENT_TIMESTAMP de MySQL
        // Esto es vital para que la API sepa qué notas sincronizar (Delta Sync)
        await db.runAsync(`
            CREATE TRIGGER IF NOT EXISTS trg_update_local_notes_timestamp
            AFTER UPDATE ON local_notes
            FOR EACH ROW
            WHEN NEW.updated_at = OLD.updated_at
            BEGIN
                UPDATE local_notes 
                SET updated_at = CURRENT_TIMESTAMP 
                WHERE id = NEW.id;
            END;
        `);

        // 2. Trigger de Auditoría Local (Equivalente al de MySQL)
        await db.runAsync(`
            CREATE TRIGGER IF NOT EXISTS trg_audit_local_notes_update
            AFTER UPDATE ON local_notes
            FOR EACH ROW
            WHEN OLD.note <> NEW.note
            BEGIN
                INSERT INTO logs_auditoria (id, tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo)
                VALUES (hex(randomblob(16)), 'local_notes', NEW.id, 'UPDATE', OLD.note, NEW.note);
            END;
        `);

        console.log('SQLite Database schemas, Foreign Keys, and Triggers initialized successfully.');
    } catch (err) {
        console.error('Error initializing SQLite schemas:', err);
    }
}

db.initSQLite = initSQLite;
module.exports = db;
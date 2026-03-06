const mysql = require('./mysql');

async function initializeMySQL() {
  try {
    const connection = await mysql.getConnection();

    // Tabla básica para probar sincronización
    await connection.query(`
      CREATE TABLE IF NOT EXISTS local_notes (
        id VARCHAR(36) PRIMARY KEY,
        sqlite_id VARCHAR(36),
        student_id VARCHAR(36),
        subject_id VARCHAR(36),
        note FLOAT,
        synced TINYINT DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Módulo 1: SIE (Sistema Institucional de Evaluación)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS escalas_valorativas (
        id VARCHAR(36) PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL,
        rango_min FLOAT NOT NULL,
        rango_max FLOAT NOT NULL,
        descripcion TEXT,
        estado TINYINT DEFAULT 1
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS periodos_academicos (
        id VARCHAR(36) PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL,
        peso_porcentual FLOAT NOT NULL,
        fecha_inicio DATE,
        fecha_fin DATE,
        estado TINYINT DEFAULT 1
      )
    `);

    // Módulo 2: Usuarios, Seguridad y Roles
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(36) PRIMARY KEY,
        identificacion VARCHAR(20) UNIQUE NOT NULL,
        nombres VARCHAR(100) NOT NULL,
        apellidos VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        estado TINYINT DEFAULT 1,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(36) PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL UNIQUE
      )
    `);

    // Inserción de roles básicos si no existen (Usamos la función nativa UUID() de MySQL)
    await connection.query(`
      INSERT IGNORE INTO roles (id, nombre) VALUES 
      (UUID(), 'Administrador'), (UUID(), 'Secretaría'), (UUID(), 'Coordinación'), 
      (UUID(), 'Docente'), (UUID(), 'Estudiante'), (UUID(), 'Acudiente'), (UUID(), 'Rector')
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios_roles (
        usuario_id VARCHAR(36),
        rol_id VARCHAR(36),
        sede_id VARCHAR(36) NULL,
        PRIMARY KEY (usuario_id, rol_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);

    // Módulo 3: Gestión Académica y Matrículas
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sedes (
        id VARCHAR(36) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        direccion VARCHAR(200),
        estado TINYINT DEFAULT 1
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS jornadas (
        id VARCHAR(36) PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS grados (
        id VARCHAR(36) PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL,
        nivel VARCHAR(50)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS grupos (
        id VARCHAR(36) PRIMARY KEY,
        grado_id VARCHAR(36),
        sede_id VARCHAR(36),
        jornada_id VARCHAR(36),
        nombre VARCHAR(20) NOT NULL,
        director_grupo_id VARCHAR(36) NULL,
        FOREIGN KEY (grado_id) REFERENCES grados(id),
        FOREIGN KEY (sede_id) REFERENCES sedes(id),
        FOREIGN KEY (jornada_id) REFERENCES jornadas(id),
        FOREIGN KEY (director_grupo_id) REFERENCES usuarios(id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS estudiantes (
        id VARCHAR(36) PRIMARY KEY,
        identificacion VARCHAR(20) UNIQUE NOT NULL,
        nombres VARCHAR(100) NOT NULL,
        apellidos VARCHAR(100) NOT NULL,
        fecha_nacimiento DATE,
        estado VARCHAR(20) DEFAULT 'Activo'
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS matriculas (
        id VARCHAR(36) PRIMARY KEY,
        estudiante_id VARCHAR(36),
        grupo_id VARCHAR(36),
        anio_lectivo INT NOT NULL,
        estado VARCHAR(20) DEFAULT 'Matriculado',
        fecha_matricula TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
        FOREIGN KEY (grupo_id) REFERENCES grupos(id)
      )
    `);

    // Módulo 4: Planeación y Malla Curricular
    await connection.query(`
      CREATE TABLE IF NOT EXISTS asignaturas (
        id VARCHAR(36) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        area_conocimiento VARCHAR(100),
        intensidad_horaria INT DEFAULT 1,
        estado TINYINT DEFAULT 1
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS carga_academica (
        id VARCHAR(36) PRIMARY KEY,
        docente_id VARCHAR(36),
        asignatura_id VARCHAR(36),
        grupo_id VARCHAR(36),
        anio_lectivo INT NOT NULL,
        FOREIGN KEY (docente_id) REFERENCES usuarios(id),
        FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id),
        FOREIGN KEY (grupo_id) REFERENCES grupos(id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS logros_competencias (
        id VARCHAR(36) PRIMARY KEY,
        asignatura_id VARCHAR(36),
        grado_id VARCHAR(36),
        periodo_id VARCHAR(36),
        descripcion TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'Logro',
        FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id),
        FOREIGN KEY (grado_id) REFERENCES grados(id),
        FOREIGN KEY (periodo_id) REFERENCES periodos_academicos(id)
      )
    `);

    // Módulo 8: Auditoría y Trazabilidad de Datos
    await connection.query(`
      CREATE TABLE IF NOT EXISTS logs_auditoria (
        id VARCHAR(36) PRIMARY KEY,
        tabla_afectada VARCHAR(50) NOT NULL,
        registro_id VARCHAR(36) NOT NULL,
        accion VARCHAR(20) NOT NULL,
        valor_anterior TEXT,
        valor_nuevo TEXT,
        usuario VARCHAR(100) DEFAULT 'Sistema/Auto',
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Trigger de Auditoría
    await connection.query(`
      CREATE TRIGGER IF NOT EXISTS trg_audit_notas_update
      AFTER UPDATE ON local_notes
      FOR EACH ROW
      BEGIN
         IF OLD.note <> NEW.note THEN
            INSERT INTO logs_auditoria (id, tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo)
            VALUES (UUID(), 'local_notes', NEW.id, 'UPDATE', OLD.note, NEW.note);
         END IF;
      END;
    `);

    console.log('MySQL Database tables and Triggers initialized.');
    connection.release();
  } catch (err) {
    console.error('Error initializing MySQL schema', err);
  }
}

module.exports = initializeMySQL;
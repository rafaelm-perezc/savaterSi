const express = require('express');
const router = express.Router();
const mysqlPool = require('../config/mysql');
const sqliteDb = require('../config/sqlite');

// Guardar Notas (Intenta MySQL, si falla cae a SQLite)
router.post('/guardar', async (req, res) => {
    const { student_id, subject_id, note } = req.body;

    if (!student_id || !subject_id || note === undefined) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    try {
        // 1. Intentar guardar en MySQL (Online)
        await mysqlPool.query(
            'INSERT INTO local_notes (student_id, subject_id, note, synced) VALUES (?, ?, ?, 1)',
            [student_id, subject_id, note]
        );

        res.json({ success: true, mode: 'online', message: 'Nota guardada en línea (MySQL).' });
    } catch (error) {
        console.warn('MySQL falló, guardando en SQLite (Offline mode)...', error.message);

        // 2. Si MySQL falla, guardar en SQLite (Offline)
        sqliteDb.run(
            'INSERT INTO local_notes (student_id, subject_id, note, synced) VALUES (?, ?, ?)',
            [student_id, subject_id, note],
            function (err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error crítico al guardar la nota.', error: err.message });
                }
                res.json({ success: true, mode: 'offline', message: 'Nota guardada localmente (SQLite). Pendiente de sincronización.' });
            }
        );
    }
});

// Obtener Notas de un grupo/asignatura (Prioriza MySQL, si no hay red usa SQLite)
router.get('/listar', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM local_notes');
        res.json({ success: true, mode: 'online', data: rows });
    } catch (error) {
        console.warn('MySQL falló, consultando SQLite (Offline mode)...');
        sqliteDb.all('SELECT * FROM local_notes', [], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, mode: 'offline', data: rows });
        });
    }
});

module.exports = router;

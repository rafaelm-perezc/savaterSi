const express = require('express');
const router = express. express.Router();
const jwt = require('jsonwebtoken');
const syncService = require('../services/syncService');
const pool = require('../config/mysql');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_colegio_123';
const isCloud = process.env.IS_CLOUD === 'true';

// Middleware para verificar el Token JWT en todas las peticiones de Sincronización
const verifySyncToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token requerido' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        next();
    });
};

// Endpoint: Recibe las notas desde Electron (PUSH)
router.post('/push', verifySyncToken, async (req, res) => {
    if (!isCloud) return res.status(403).json({ error: 'Acción solo permitida en la nube.' });
    try {
        const { notes } = req.body;
        const processed = await syncService.processCloudPush(notes);
        res.json({ success: true, processed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Envía las notas actualizadas hacia Electron (PULL)
router.get('/pull', verifySyncToken, async (req, res) => {
    if (!isCloud) return res.status(403).json({ error: 'Acción solo permitida en la nube.' });
    try {
        const lastUpdate = req.query.lastUpdate || '1970-01-01 00:00:00';
        const updates = await syncService.getCloudUpdatesSince(lastUpdate);
        res.json({ success: true, data: updates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Conteo de tablas para el Bootstrapper
router.get('/bootstrapper/count/:table', verifySyncToken, async (req, res) => {
    if (!isCloud) return res.status(403).json({ error: 'Acción solo permitida en la nube.' });
    try {
        const tableName = req.params.table.replace(/[^a-zA-Z0-9_]/g, ''); // Sanitización básica
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        res.json({ count: rows[0].count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Descarga paginada de tablas base para el Bootstrapper
router.get('/bootstrapper/pull/:table', verifySyncToken, async (req, res) => {
    if (!isCloud) return res.status(403).json({ error: 'Acción solo permitida en la nube.' });
    try {
        const tableName = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
        const limit = parseInt(req.query.limit) || 500;
        const offset = parseInt(req.query.offset) || 0;

        const [rows] = await pool.query(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`, [limit, offset]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
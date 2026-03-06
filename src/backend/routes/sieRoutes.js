const express = require('express');
const router = express.Router();
const pool = require('../config/mysql');

// =============== ESCALAS VALORATIVAS ===============

// Obtener todas las escalas
router.get('/escalas', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM escalas_valorativas');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear una nueva escala
router.post('/escalas', async (req, res) => {
    const { nombre, rango_min, rango_max, descripcion } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO escalas_valorativas (nombre, rango_min, rango_max, descripcion) VALUES (?, ?, ?, ?)',
            [nombre, rango_min, rango_max, descripcion]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============== PERIODOS ACADÉMICOS ===============

// Obtener todos los periodos
router.get('/periodos', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM periodos_academicos');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear un nuevo periodo
router.post('/periodos', async (req, res) => {
    const { nombre, peso_porcentual, fecha_inicio, fecha_fin } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO periodos_academicos (nombre, peso_porcentual, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?)',
            [nombre, peso_porcentual, fecha_inicio, fecha_fin]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

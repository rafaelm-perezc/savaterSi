const express = require('express');
const router = express.Router();
const pool = require('../config/mysql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_savater_key_2026';

// Register User (Solo para setup inicial o Admin)
router.post('/register', async (req, res) => {
    const { identificacion, nombres, apellidos, email, password, role_id } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const [result] = await pool.query(
            'INSERT INTO usuarios (identificacion, nombres, apellidos, email, password_hash) VALUES (?, ?, ?, ?, ?)',
            [identificacion, nombres, apellidos, email, passwordHash]
        );

        const userId = result.insertId;

        if (role_id) {
            await pool.query('INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES (?, ?)', [userId, role_id]);
        }

        res.json({ success: true, message: 'Usuario creado exitosamente', id: userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login User
router.post('/login', async (req, res) => {
    const { identificacion, password } = req.body;

    try {
        // 1. Check user exists
        const [users] = await pool.query('SELECT * FROM usuarios WHERE identificacion = ? AND estado = 1', [identificacion]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas o usuario inactivo' });
        }

        const user = users[0];

        // 2. Verifica contraseña
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        // 3. Traer Roles
        const [roles] = await pool.query(`
      SELECT r.nombre, ur.sede_id 
      FROM roles r 
      JOIN usuarios_roles ur ON r.id = ur.rol_id 
      WHERE ur.usuario_id = ?
    `, [user.id]);

        // 4. Generar Token
        const payload = {
            id: user.id,
            identificacion: user.identificacion,
            nombres: user.nombres,
            apellidos: user.apellidos,
            roles: roles
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

        res.json({
            success: true,
            token,
            user: payload
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

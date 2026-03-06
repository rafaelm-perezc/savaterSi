const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const http = require('http');

dotenv.config();

const app = express();
const INITIAL_PORT = parseInt(process.env.PORT) || 3000;
const MAX_PORT_ATTEMPTS = 10; // Límite de intentos para evitar un Stack Overflow (Recursividad infinita)

app.use(cors());
app.use(express.json());

// Ruta básica para verificar la salud del servidor
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// Importar servicios
const startCloningProcess = require('./services/dbBootstrapper');

// Importar rutas
const sieRoutes = require('./routes/sieRoutes');
const authRoutes = require('./routes/authRoutes');
const notasRoutes = require('./routes/notasRoutes');
const boletinesRoutes = require('./routes/boletinesRoutes');
const certificadosRoutes = require('./routes/certificadosRoutes');
const syncRoutes = require('./routes/syncRoutes'); // Ruta de sincronización creada en el paso 2

// Montar Rutas de la API
app.use('/api/sie', sieRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notas', notasRoutes);
app.use('/api/boletines', boletinesRoutes);
app.use('/api/certificados', certificadosRoutes);
app.use('/api/sync', syncRoutes); // Reemplaza la antigua función manual

// Inicializar Base de Datos y levantar el Servidor
startCloningProcess()
    .then(() => {
        function startServer(port, attempts = 0) {
            // Caso base: Si superamos el límite de intentos, abortamos para no colapsar la memoria
            if (attempts >= MAX_PORT_ATTEMPTS) {
                console.error(`[Fatal] No se encontró un puerto libre después de ${MAX_PORT_ATTEMPTS} intentos.`);
                process.exit(1);
            }

            const server = http.createServer(app);

            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`El puerto ${port} está ocupado. Intentando con el ${port + 1}...`);
                    startServer(port + 1, attempts + 1);
                } else {
                    console.error('Error al iniciar el servidor HTTP:', err);
                }
            });

            server.listen(port, () => {
                console.log(`Server is running on port ${port}`);
                // Guardar puerto activo para que Electron lo reconozca si el inicial estaba ocupado
                try {
                    fs.writeFileSync(path.join(__dirname, '../../port.json'), JSON.stringify({ port }));
                } catch (writeErr) {
                    console.error('Advertencia: No se pudo escribir el archivo port.json', writeErr);
                }
            });
        }

        // Iniciar búsqueda de un puerto libre empezando por el definido
        startServer(INITIAL_PORT);
    })
    .catch((error) => {
        // Bloque Catch crítico: Si el bootstrapper falla (ej. error de conexión), el proceso Node se detiene de forma segura.
        console.error('[Fatal] Error crítico durante el inicio/sincronización de las bases de datos:', error);
        process.exit(1); 
    });
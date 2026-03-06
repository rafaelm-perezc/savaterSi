const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;
let isBackendReady = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

function startBackend() {
    const serverPath = path.join(__dirname, '../backend/server.js');
    
    // Iniciamos el proceso hijo forzando el modo local (IS_CLOUD=false)
    backendProcess = spawn('node', [serverPath], {
        env: { ...process.env, FROM_ELECTRON: 'true', IS_CLOUD: 'false' }
    });

    backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Backend stdout: ${output}`);

        // SOLUCIÓN PUNTO 5B: En lugar de un setTimeout de 5 segundos, 
        // escuchamos el log exacto en que el servidor avisa que levantó.
        if (output.includes('Server is running on port') && !isBackendReady) {
            isBackendReady = true;
            console.log('[Electron] Servidor Node listo detectado. Iniciando sincronización silenciosa...');
            triggerSilentSync();
        }
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`Backend stderr: ${data.toString()}`);
    });
}

function triggerSilentSync() {
    try {
        let backendPort = 3000;
        try {
            const portData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../port.json'), 'utf-8'));
            backendPort = portData.port;
        } catch (e) { 
            // Fallback silencioso si no existe el port.json
        }

        const request = net.request(`http://localhost:${backendPort}/api/sync`);

        request.on('response', (response) => {
            response.on('data', (chunk) => {
                console.log(`[Sync result] ${chunk.toString()}`);
            });
        });
        
        request.on('error', (err) => {
            console.log('[Electron] Sync silencioso detectó que el servidor no está disponible (Offline).');
        });
        
        request.end();
    } catch (err) {
        console.error('[Electron] Error en sincronización de fondo:', err);
    }
}

app.whenReady().then(() => {
    // Iniciamos el backend independientemente de si está empaquetado o no,
    // ya que ahora es el motor principal de SQLite.
    startBackend();
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// SOLUCIÓN PUNTO 5A: Evento before-quit (Previene Procesos Zombis).
// Se dispara incluso si el usuario hace ALT+F4 o cmd+Q, asegurando que 
// el servidor Node.js local muera junto con la aplicación gráfica.
app.on('before-quit', () => {
    if (backendProcess) {
        console.log('[Electron] Matando proceso hijo de Node.js de forma segura...');
        backendProcess.kill();
    }
});

// Manejador IPC para impresión nativa de PDFs (Boletines/Certificados offline)
ipcMain.handle('print-to-pdf', async (event, content) => {
    try {
        const pdfData = await mainWindow.webContents.printToPDF({});
        return { success: true, data: pdfData };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Manejador IPC para el puerto dinámico
ipcMain.handle('get-backend-port', async () => {
    try {
        const portData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../port.json'), 'utf-8'));
        return `http://localhost:${portData.port}`;
    } catch (e) {
        return `http://localhost:3000`; // Default fallback
    }
});
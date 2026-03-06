const pool = require('../config/mysql');
const db = require('../config/sqlite');
const jwt = require('jsonwebtoken');

// Variables de entorno clave para la arquitectura Híbrida
const isCloud = process.env.IS_CLOUD === 'true'; 
const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'secreto_colegio_123';

class SyncService {
    constructor() {
        this.isSyncing = false;
    }

    // Genera un token JWT temporal para que Electron hable con la Nube de forma segura
    generateSyncToken() {
        return jwt.sign({ origin: 'electron-client' }, JWT_SECRET, { expiresIn: '15m' });
    }

    // ==========================================
    // LÓGICA DEL CLIENTE LOCAL (ELECTRON / SQLITE)
    // ==========================================
    async runSyncLocal() {
        if (this.isSyncing) return { status: 'busy', message: 'Sincronización en progreso.' };
        this.isSyncing = true;
        let pushCount = 0;
        let pullCount = 0;

        try {
            console.log('[Sync Local] Iniciando sincronización segura vía API...');
            const token = this.generateSyncToken();
            const headers = { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            };

            // 1. PUSH: Enviar notas locales al Servidor
            const unsyncedNotes = await db.allAsync('SELECT * FROM local_notes WHERE synced = 0');
            
            if (unsyncedNotes.length > 0) {
                const pushRes = await fetch(`${CLOUD_API_URL}/sync/push`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ notes: unsyncedNotes })
                });

                if (!pushRes.ok) throw new Error('Falló el Push al servidor nube.');
                
                // Si la nube aceptó los datos, marcamos como sincronizado localmente
                for (const note of unsyncedNotes) {
                    await db.runAsync('UPDATE local_notes SET synced = 1 WHERE id = ?', [note.id]);
                    pushCount++;
                }
            }

            // 2. PULL: Sincronización Diferencial (Delta Sync) - Solo traemos lo modificado recientemente
            const lastSyncRow = await db.allAsync('SELECT MAX(updated_at) as last_update FROM local_notes');
            const lastUpdate = lastSyncRow[0].last_update || '1970-01-01 00:00:00';

            const pullRes = await fetch(`${CLOUD_API_URL}/sync/pull?lastUpdate=${encodeURIComponent(lastUpdate)}`, {
                headers
            });

            if (!pullRes.ok) throw new Error('Falló el Pull desde el servidor nube.');
            const { data: remoteNotes } = await pullRes.json();

            // Resolución de conflictos: El registro más reciente gana
            for (const rNote of remoteNotes) {
                const localExisting = await db.allAsync('SELECT id, updated_at FROM local_notes WHERE id = ?', [rNote.id]);
                
                if (localExisting.length > 0) {
                    const localDate = new Date(localExisting[0].updated_at);
                    const remoteDate = new Date(rNote.updated_at);
                    
                    if (remoteDate > localDate) {
                        await db.runAsync(`UPDATE local_notes SET note = ?, updated_at = ?, synced = 1 WHERE id = ?`, 
                            [rNote.note, rNote.updated_at, rNote.id]);
                    }
                } else {
                    await db.runAsync(`INSERT INTO local_notes (id, student_id, subject_id, note, synced, updated_at) VALUES (?, ?, ?, ?, 1, ?)`, 
                        [rNote.id, rNote.student_id, rNote.subject_id, rNote.note, rNote.updated_at]);
                }
                pullCount++;
            }

            this.isSyncing = false;
            return { status: 'success', message: `Sync API completado. ${pushCount} subidas, ${pullCount} descargadas.` };

        } catch (error) {
            console.error('[Sync Local] Error:', error);
            this.isSyncing = false;
            return { status: 'error', message: 'Fallo en sincronización vía API.', error: error.message };
        }
    }

    // ==========================================
    // LÓGICA DEL SERVIDOR CLOUD (API / MYSQL)
    // ==========================================
    
    // Procesa el Push que envía Electron
    async processCloudPush(notes) {
        let processed = 0;
        for (const note of notes) {
            // UPSERT en MySQL: Actualiza solo si la fecha entrante es más reciente que la guardada
            await pool.query(`
                INSERT INTO local_notes (id, student_id, subject_id, note, updated_at) 
                VALUES (?, ?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE 
                note = IF(VALUES(updated_at) > updated_at, VALUES(note), note),
                updated_at = IF(VALUES(updated_at) > updated_at, VALUES(updated_at), updated_at)
            `, [note.id, note.student_id, note.subject_id, note.note, note.updated_at]);
            processed++;
        }
        return processed;
    }

    // Devuelve los datos para el Pull de Electron
    async getCloudUpdatesSince(lastUpdate) {
        const [rows] = await pool.query('SELECT * FROM local_notes WHERE updated_at > ?', [lastUpdate]);
        return rows;
    }

    // Método de entrada unificado
    async runSync() {
        if (isCloud) {
            return { status: 'info', message: 'El servidor nube no inicia syncs. Espera peticiones de Electron.' };
        }
        return await this.runSyncLocal();
    }
}

module.exports = new SyncService();
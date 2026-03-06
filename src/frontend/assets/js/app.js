document.addEventListener('DOMContentLoaded', () => {
    const btnTestApi = document.getElementById('btnTestApi');
    const statusIndicator = document.getElementById('statusIndicator');

    // Verificamos si estamos dentro de Electron o en un navegador estándar
    const isElectron = !!(window.electronAPI);
    console.log('Ejecutando en entorno Electron:', isElectron);

    const getBackendUrl = async () => {
        return (isElectron && window.electronAPI && window.electronAPI.getBackendUrl) 
            ? await window.electronAPI.getBackendUrl() 
            : 'http://localhost:3000';
    };

    // Función auxiliar para hacer peticiones con límite de tiempo (Timeout)
    // Evita que la app se quede "cargando" infinitamente si se cae la red
    const fetchWithTimeout = async (resource, options = {}) => {
        const { timeout = 5000 } = options; // 5 segundos por defecto
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(resource, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    };

    async function testConnection() {
        if (!statusIndicator) return;
        
        try {
            statusIndicator.innerHTML = '<span class="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></span> Verificando ruta API...';
            const url = await getBackendUrl();
            
            const response = await fetchWithTimeout(`${url}/api/health`, { timeout: 3000 });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'ok') {
                statusIndicator.innerHTML = '<span class="w-3 h-3 rounded-full bg-green-500"></span> Conectado al Servidor (Node.js)';
                statusIndicator.classList.replace('bg-gray-50', 'bg-green-50');
                statusIndicator.classList.replace('border-gray-200', 'border-green-200');
                statusIndicator.classList.replace('text-gray-600', 'text-green-700');

                Swal.fire({
                    icon: 'success',
                    title: 'Conexión Exitosa',
                    text: `El backend respondió: ${data.message}`,
                    confirmButtonColor: '#16a34a'
                });
            }
        } catch (error) {
            console.error('Test Connection Error:', error);
            statusIndicator.innerHTML = '<span class="w-3 h-3 rounded-full bg-red-500"></span> Sin conexión (Modo Offline)';
            statusIndicator.classList.replace('bg-green-50', 'bg-red-50');
            statusIndicator.classList.replace('bg-gray-50', 'bg-red-50');
            statusIndicator.classList.replace('border-green-200', 'border-red-200');
            statusIndicator.classList.replace('border-gray-200', 'border-red-200');
            statusIndicator.classList.replace('text-green-700', 'text-red-700');
            statusIndicator.classList.replace('text-gray-600', 'text-red-700');

            // Mensaje amigable para el usuario si es por Timeout o caída de red
            const errorMsg = error.name === 'AbortError' 
                ? 'El servidor tardó demasiado en responder.' 
                : 'Verifica que el servidor esté corriendo o tu conexión a internet.';

            Swal.fire({
                icon: 'error',
                title: 'Modo Offline Activo',
                text: errorMsg,
                confirmButtonColor: '#d33'
            });
        }
    }

    if (btnTestApi) {
        btnTestApi.addEventListener('click', testConnection);
    }

    // --- Lógica de la Planilla Ágil (Guardado de Notas) ---
    const saveNoteButtons = document.querySelectorAll('.btn-save-note');

    saveNoteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnElement = e.target;
            const tr = btnElement.closest('tr');
            const inputs = tr.querySelectorAll('.nota-input');
            const studentId = btnElement.getAttribute('data-student');

            const notaValue = inputs[0]?.value;
            const subjectId = 1; // Matemáticas (Simulado)

            if (!notaValue) {
                return Swal.fire('Atención', 'Debes ingresar un valor antes de guardar.', 'warning');
            }

            const originalText = btnElement.textContent;
            btnElement.textContent = 'Guardando...';
            btnElement.disabled = true;

            try {
                const url = await getBackendUrl();
                // Usamos Timeout para no dejar el botón "Guardando..." para siempre si se cae el WiFi
                const res = await fetchWithTimeout(`${url}/api/notas/guardar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ student_id: studentId, subject_id: subjectId, note: notaValue }),
                    timeout: 5000 
                });

                if (!res.ok) {
                    throw new Error(`Error del servidor: ${res.status}`);
                }

                const data = await res.json();

                if (data.mode === 'online') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Guardado',
                        text: 'Nota registrada exitosamente en la Nube.',
                        timer: 2000,
                        showConfirmButton: false
                    });
                } else {
                    Swal.fire({
                        icon: 'info',
                        title: 'Guardado Local',
                        text: 'Sin conexión a la nube. Nota respaldada localmente en tu equipo.',
                        confirmButtonColor: '#3085d6'
                    });
                }
            } catch (err) {
                console.error('Error al guardar nota:', err);
                // Diferenciar si fue un error de red (offline) o de código
                if (err.name === 'TypeError' || err.name === 'AbortError') {
                    Swal.fire('Modo Offline', 'No hay conexión. Asegúrate de tener el motor local encendido.', 'warning');
                } else {
                    Swal.fire('Error Crítico', 'Ocurrió un problema al procesar la nota.', 'error');
                }
            } finally {
                // Siempre devolver el botón a su estado original, falle o no
                btnElement.textContent = originalText;
                btnElement.disabled = false;
            }
        });
    });

    // --- Lógica de Sincronización Manual ---
    const btnSync = document.getElementById('btnSync');
    
    if (btnSync) {
        btnSync.addEventListener('click', async () => {
            const originalText = btnSync.innerHTML;
            btnSync.innerHTML = 'Sincronizando... <span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full ml-2"></span>';
            btnSync.disabled = true;

            try {
                const url = await getBackendUrl();
                const res = await fetchWithTimeout(`${url}/api/sync`, { timeout: 15000 }); // Damos 15s porque la sync puede ser pesada
                
                if (!res.ok) {
                    throw new Error(`Fallo en sincronización (Status: ${res.status})`);
                }

                const data = await res.json();

                if (data.status === 'success') {
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'success',
                        title: 'Sincronización completada exitosamente',
                        showConfirmButton: false,
                        timer: 3000
                    });
                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Atención',
                        text: data.message || 'La sincronización terminó con advertencias.',
                        confirmButtonColor: '#f59e0b'
                    });
                }
            } catch (err) {
                console.error('Error de Sincronización', err);
                Swal.fire({
                    icon: 'info',
                    title: 'Sincronización Pausada',
                    text: 'Actualmente no tienes conexión estable con la nube. Los datos siguen seguros en tu equipo.',
                    confirmButtonColor: '#3b82f6'
                });
            } finally {
                btnSync.innerHTML = originalText;
                btnSync.disabled = false;
            }
        });
    }

    // Chequeo inicial automático al abrir la aplicación
    setTimeout(() => {
        if(btnTestApi) testConnection();
    }, 1500);
});
const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Asegurar que exista la carpeta de descargas
const reportesPath = path.join(__dirname, '../../reportes');
if (!fs.existsSync(reportesPath)) {
    fs.mkdirSync(reportesPath, { recursive: true });
}

// Generación de Boletín Individual
router.post('/generar-boletin', async (req, res) => {
    const { student_id, periodo_id } = req.body;

    if (!student_id || !periodo_id) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos (student_id, periodo_id)' });
    }

    let browser;
    try {
        // En un entorno real se harían joins a la DB para traer notas y datos del estudiante.
        // Aquí armamos un HTML de estructura base validando Puppeteer.
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Helvetica', sans-serif; padding: 40px; }
                .header { text-align: center; border-bottom: 2px solid #16a34a; padding-bottom: 20px; margin-bottom: 30px; }
                .school-name { font-size: 24px; font-weight: bold; color: #14532d; }
                .title { font-size: 18px; color: #333; margin-top: 10px; }
                .student-info { margin-bottom: 30px; padding: 15px; background-color: #f0fdf4; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #ccc; padding: 10px; text-align: center; }
                th { background-color: #dcfce7; color: #15803d; }
                .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="school-name">Institución Educativa SavaterSi</div>
                <div class="title">Boletín Informativo - Periodo ${periodo_id}</div>
            </div>
            
            <div class="student-info">
                <strong>Estudiante ID:</strong> ${student_id} <br>
                <strong>Grado:</strong> 6A <br>
                <strong>Director de Grupo:</strong> Prof. Ejemplo
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Asignatura</th>
                        <th>IHS</th>
                        <th>Fallas</th>
                        <th>Definitiva</th>
                        <th>Desempeño</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="text-align: left;">Matemáticas</td>
                        <td>4</td>
                        <td>0</td>
                        <td>4.5</td>
                        <td>Alto</td>
                    </tr>
                    <tr>
                        <td style="text-align: left;">Biología</td>
                        <td>3</td>
                        <td>1</td>
                        <td>3.8</td>
                        <td>Básico</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                Documento generado automáticamente el ${new Date().toLocaleDateString()}<br>
                <strong>SavaterSi - Sistema de Gestión Escolar</strong>
            </div>
        </body>
        </html>
        `;

        // Iniciar Puppeteer
        browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const fileName = `boletin_${student_id}_p${periodo_id}_${Date.now()}.pdf`;
        const filePath = path.join(reportesPath, fileName);

        await page.pdf({
            path: filePath,
            format: 'Letter',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });

        res.json({ success: true, message: 'Boletín generado con éxito', path: filePath, fileName });

    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ error: 'Error al generar el boletín PDF' });
    } finally {
        if (browser) await browser.close();
    }
});

module.exports = router;

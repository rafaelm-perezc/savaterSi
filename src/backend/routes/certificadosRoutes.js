const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const mysqlPool = require('../config/mysql');

const certificadosPath = path.join(__dirname, '../../reportes/certificados');
if (!fs.existsSync(certificadosPath)) {
    fs.mkdirSync(certificadosPath, { recursive: true });
}

// Generar Certificado de Estudio (Matrícula Activa)
router.post('/estudio', async (req, res) => {
    const { student_id } = req.body;

    if (!student_id) return res.status(400).json({ error: 'Falta student_id' });

    let browser;
    try {
        const [estudiantes] = await mysqlPool.query('SELECT nombres, apellidos, identificacion FROM estudiantes WHERE id = ?', [student_id]);

        if (estudiantes.length === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado en la Base de Datos (Nube)' });
        }

        const est = estudiantes[0];
        const consecutivo = `CERT-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`;

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Helvetica', sans-serif; padding: 60px; line-height: 1.6; }
                .header { text-align: center; margin-bottom: 50px; }
                .school-name { font-size: 28px; font-weight: bold; color: #1e3a8a; }
                .title { font-size: 22px; font-weight: bold; margin-top: 20px; text-decoration: underline; }
                .content { font-size: 16px; text-align: justify; margin-top: 40px; }
                .signatures { margin-top: 100px; display: flex; justify-content: space-around; }
                .sign-box { text-align: center; border-top: 1px solid #000; width: 250px; padding-top: 10px; }
                .footer { margin-top: 80px; text-align: center; font-size: 12px; color: #666; }
                .consecutivo { text-align: right; color: #dc2626; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="consecutivo">No. ${consecutivo}</div>
            
            <div class="header">
                <div class="school-name">INSTITUCIÓN EDUCATIVA SAVATERSI</div>
                <div>Aprobado por resolución departamental No. 12345</div>
            </div>
            
            <div class="title" style="text-align: center;">HACE CONSTAR:</div>
            
            <div class="content">
                Que el(la) estudiante <strong>${est.nombres} ${est.apellidos}</strong>, identificado(a) con documento número <strong>${est.identificacion}</strong>, 
                se encuentra actualmente matriculado(a) y cursando de manera regular sus estudios en el grado <strong>6A</strong> 
                durante el año lectivo <strong>${new Date().getFullYear()}</strong> en esta institución.
                <br><br>
                Se expide este certificado a solicitud del interesado, a los <strong>${new Date().getDate()}</strong> días del mes de <strong>${new Date().toLocaleString('es', { month: 'long' })}</strong> del año <strong>${new Date().getFullYear()}</strong>.
            </div>

            <div class="signatures">
                <div class="sign-box">
                    <strong>Rector(a)</strong><br>
                    Institución Educativa SavaterSi
                </div>
                <div class="sign-box">
                    <strong>Secretaría Académica</strong><br>
                    Institución Educativa SavaterSi
                </div>
            </div>

            <div class="footer">
                Documento generado por SavaterSi Platform.<br>
                Código de Verificación: ${consecutivo}
            </div>
        </body>
        </html>
        `;

        browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const fileName = `${consecutivo}.pdf`;
        const filePath = path.join(certificadosPath, fileName);

        await page.pdf({
            path: filePath,
            format: 'Letter',
            printBackground: true,
            margin: { top: '30px', right: '30px', bottom: '30px', left: '30px' }
        });

        res.json({ success: true, message: 'Certificado de Estudio Generado', path: filePath, url: `/certificados/${fileName}` });

    } catch (error) {
        console.error('Error generando certificado:', error);
        res.status(500).json({ error: 'Error interno en generación PDF' });
    } finally {
        if (browser) await browser.close();
    }
});

module.exports = router;

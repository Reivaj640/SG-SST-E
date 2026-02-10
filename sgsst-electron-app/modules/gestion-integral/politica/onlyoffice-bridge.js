// onlyoffice-bridge.js - Servidor Bridge para OnlyOffice (MODO PRODUCCION)
// ============================================================================
// Logs reducidos - Solo errores y eventos importantes
// ============================================================================

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ============================================================================
// CONFIGURACION
// ============================================================================
const app = express();
const PORT = 3011;
const ONLYOFFICE_SERVER = 'http://localhost:8080';
const ONLYOFFICE_EDITOR_URL = 'http://localhost:8080/office-apps/editor/index.html';

// Usar host.docker.internal para que OnlyOffice (en Docker) pueda acceder al Bridge desde el host
const BRIDGE_HOST = 'host.docker.internal';
const BRIDGE_URL = `http://${BRIDGE_HOST}:${PORT}`;

// JWT SECRET - Debe coincidir con el contenedor OnlyOffice
const JWT_SECRET = 'P6dJQcyvA4LstDY2h16Jh6ay8SEJrMUY';

// Almacenamiento temporal para relacionar LLAVE -> RUTA
const documentKeys = {};

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware de logging para diagnosticar peticiones
app.use((req, res, next) => {
    console.log(`[BRIDGE] ${req.method} ${req.url} desde ${req.ip}`);
    next();
});

// CORS headers para permitir acceso desde OnlyOffice en Docker
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// ============================================================================
// FUNCIONES JWT
// ============================================================================
function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64');
}

function createJWT(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    
    const tokenPayload = {
        ...payload,
        iat: now,
        exp: now + 3600  // 1 hora de expiracion
    };
    
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const payload = JSON.parse(base64UrlDecode(parts[1]).toString());
        const expectedSignature = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${parts[0]}.${parts[1]}`)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        
        if (parts[2] !== expectedSignature) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

// ============================================================================
// RUTAS DEL BRIDGE
// ============================================================================

// 1. Registrar llave del documento
app.post('/register-key', (req, res) => {
    const { key, filePath } = req.body;
    documentKeys[key] = filePath;
    res.json({ success: true });
});

// 2. Servir archivo a OnlyOffice (proxy CON JWT)
app.get('/fetch-file', async (req, res) => {
    console.log(`[BRIDGE] 📨 /fetch-file solicitado`);
    console.log(`[BRIDGE] 🔍 Query params:`, req.query);
    console.log(`[BRIDGE] 🔍 Headers:`, req.headers);
    
    const { filePath, token } = req.query;
    
    if (!filePath) {
        console.error(`[BRIDGE] ❌ /fetch-file rechazado: filePath vacío`);
        return res.status(400).json({ error: 'filePath es requerido' });
    }
    
    const decodedFilePath = decodeURIComponent(filePath);
    console.log(`[BRIDGE] 🔍 Decoded filePath:`, decodedFilePath);
    
    if (!fs.existsSync(decodedFilePath)) {
        console.error(`[BRIDGE] ❌ /fetch-file rechazado: archivo no encontrado`);
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    try {
        const stats = fs.statSync(decodedFilePath);
        const ext = path.extname(decodedFilePath).toLowerCase();
        
        console.log('[BRIDGE] /fetch-file - filePath:', decodedFilePath);
        
        if (!fs.existsSync(decodedFilePath)) {
            console.error('[BRIDGE] Archivo no encontrado:', decodedFilePath);
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        // Content-Type según extensión
        const contentTypes = {
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.pdf': 'application/pdf'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        // Configurar headers CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(decodedFilePath)}"`);
        
        // Enviar archivo
        const fileStream = fs.createReadStream(decodedFilePath);
        fileStream.pipe(res);
        
        fileStream.on('error', (err) => {
            console.error('[BRIDGE] Error leyendo archivo:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error leyendo archivo' });
            }
        });
        
        console.log('[BRIDGE] Archivo enviado correctamente:', path.basename(decodedFilePath), '- Tamaño:', stats.size, 'bytes');
        
    } catch (error) {
        console.error('[BRIDGE] Error procesando archivo:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 3. Callback para guardar documentos modificados
app.post('/track', (req, res) => {
    const authHeader = req.headers['authorization'];
    const { status, url, key, token } = req.body;
    
    // Verificar token del body o del header Authorization
    let tokenToVerify = token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        tokenToVerify = authHeader.replace('Bearer ', '');
    }
    
    if (tokenToVerify) verifyJWT(tokenToVerify);

    if (status === 2 && url) {
        const filePath = documentKeys[key];
        if (filePath) {
            const writeStream = fs.createWriteStream(filePath);
            
            https.get(url, (response) => {
                response.pipe(writeStream)
                    .on('finish', () => {
                        console.log('[BRIDGE] Archivo guardado:', key);
                    })
                    .on('error', (err) => {
                        console.error('[BRIDGE] Error guardando:', err.message);
                    });
            }).on('error', (err) => {
                console.error('[BRIDGE] Error descargando de OnlyOffice:', err.message);
            });
        }
    }

    res.json({ error: 0 });
});

// 4. Endpoint para obtener configuracion del editor CON JWT
app.post('/get-editor-config', async (req, res) => {
    console.log('[BRIDGE] 📨 POST /get-editor-config solicitado');
    console.log('[BRIDGE] 🔍 Request body:', JSON.stringify(req.body, null, 2));
    
    const { filePath, fileName, documentKey } = req.body;
    
    try {
        const ext = path.extname(filePath).toLowerCase();
        let documentType = 'word';
        if (['.xls', '.xlsx'].includes(ext)) documentType = 'cell';
        if (['.ppt', '.pptx'].includes(ext)) documentType = 'slide';
        
        const documentUrl = `${BRIDGE_URL}/fetch-file?filePath=${encodeURIComponent(filePath)}`;
        const callbackUrl = `${BRIDGE_URL}/track`;
        
        console.log('[BRIDGE] 🔗 Document URL:', documentUrl);
        console.log('[BRIDGE] 🔗 Callback URL:', callbackUrl);
        
        const editorConfig = {
            document: {
                fileType: ext.replace('.', ''),
                key: documentKey,
                title: fileName,
                url: documentUrl,
                permissions: {
                    edit: true,
                    download: true,
                    print: true,
                    review: true,
                    comment: true,
                    fillForms: true
                }
            },
            documentType: documentType,
            editorConfig: {
                mode: 'edit',
                lang: 'es-ES',
                callbackUrl: callbackUrl,
                user: {
                    id: 'user-1',
                    name: 'Usuario K+AIR'
                },
                customization: {
                    autosave: true,
                    forcesave: true,
                    compactHeader: false,
                    hideRightMenu: false,
                    hideRulers: false,
                    showSpellCheckInputMode: true
                }
            },
            onlyofficeServerUrl: ONLYOFFICE_EDITOR_URL
        };
        
        console.log('[BRIDGE] 🔧 Generando JWT token con toda la configuración...');
        
        const token = createJWT(editorConfig);
        
        console.log('[BRIDGE] ✅ Token JWT generado:', token.substring(0, 50) + '...');

        editorConfig.token = token;

        documentKeys[documentKey] = decodeURIComponent(filePath);
        
        console.log('[BRIDGE] 📤 Enviando respuesta JSON completa:');
        console.log('[BRIDGE]', JSON.stringify(editorConfig, null, 2));
        
        res.json({ success: true, config: editorConfig });
        
    } catch (error) {
        console.error('[BRIDGE] Error generando config:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================
let server = null;

function startServer() {
    return new Promise((resolve, reject) => {
        console.log(`[BRIDGE] Intentando iniciar servidor en puerto ${PORT} en 0.0.0.0...`);
        
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`[BRIDGE] ✅ Servidor OnlyOffice Bridge iniciado exitosamente`);
            console.log(`[BRIDGE] 🌐 Escuchando en: http://0.0.0.0:${PORT}`);
            console.log(`[BRIDGE] 🔗 URL para Docker: http://host.docker.internal:${PORT}`);
            resolve(server);
        });
        
        server.on('error', (err) => {
            console.error(`[BRIDGE] ❌ Error iniciando servidor:`, err.message);
            if (err.code === 'EADDRINUSE') {
                console.warn(`[BRIDGE] ⚠️ Puerto ${PORT} ocupado, intentando puerto ${PORT + 1}...`);
                server = app.listen(PORT + 1, '0.0.0.0', () => {
                    console.log(`[BRIDGE] ✅ Servidor OnlyOffice Bridge iniciado en puerto ${PORT + 1}`);
                    console.log(`[BRIDGE] 🌐 Escuchando en: http://0.0.0.0:${PORT + 1}`);
                    console.log(`[BRIDGE] 🔗 URL para Docker: http://host.docker.internal:${PORT + 1}`);
                    resolve(server);
                });
            } else {
                reject(err);
            }
        });
        
        server.on('connection', (socket) => {
            console.log(`[BRIDGE] 🔌 Nueva conexión desde ${socket.remoteAddress}:${socket.remotePort}`);
        });
    });
}

function stopServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => {
                console.log('[BRIDGE] Servidor detenido');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

module.exports = { startServer, stopServer };

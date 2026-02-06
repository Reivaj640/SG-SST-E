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

// JWT SECRET - Debe coincidir con el contenedor OnlyOffice
const JWT_SECRET = 'P6dJQcyvA4LstDY2h16Jh6ay8SEJrMUY';

// Almacenamiento temporal para relacionar LLAVE -> RUTA
const documentKeys = {};

// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
    const { filePath, token } = req.query;
    
    if (!filePath) {
        return res.status(400).json({ error: 'filePath es requerido' });
    }
    
    const decodedFilePath = decodeURIComponent(filePath);
    
    if (!fs.existsSync(decodedFilePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    try {
        let jwtToken = token;
        
        if (jwtToken) {
            const verified = verifyJWT(jwtToken);
            if (!verified) jwtToken = null;
        }
        
        if (!jwtToken) {
            jwtToken = createJWT({ 
                file: decodedFilePath,
                action: 'download'
            });
        }
        
        const onlyofficeUrl = `http://localhost:8080/FileUploader.ashx?filePath=${encodeURIComponent(decodedFilePath)}&token=${encodeURIComponent(jwtToken)}`;
        res.redirect(onlyofficeUrl);
        
    } catch (error) {
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
    const { filePath, fileName, documentKey } = req.body;
    
    try {
        const token = createJWT({ 
            file: decodeURIComponent(filePath),
            document: {
                key: documentKey,
                title: fileName,
                type: 'desktop'
            },
            action: 'open'
        });
        
        const ext = path.extname(filePath).toLowerCase();
        let documentType = 'word';
        if (['.xls', '.xlsx'].includes(ext)) documentType = 'cell';
        if (['.ppt', '.pptx'].includes(ext)) documentType = 'slide';
        
        const BRIDGE_URL = `http://localhost:${PORT}`;
        const documentUrl = `${BRIDGE_URL}/fetch-file?filePath=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;
        const callbackUrl = `${BRIDGE_URL}/track`;
        
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
        
        documentKeys[documentKey] = decodeURIComponent(filePath);
        
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
        server = app.listen(PORT, () => {
            console.log(`[BRIDGE] OnlyOffice Bridge corriendo en puerto ${PORT}`);
            resolve(server);
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.warn(`[BRIDGE] Puerto ${PORT} ocupado, reintentando...`);
                server = app.listen(PORT + 1, () => {
                    console.log(`[BRIDGE] OnlyOffice Bridge corriendo en puerto ${PORT + 1}`);
                    resolve(server);
                });
            } else {
                reject(err);
            }
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

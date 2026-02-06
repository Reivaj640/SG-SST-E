// test-jwt.js - Verificar generación de token JWT
const crypto = require('crypto');

const JWT_SECRET = 'P6dJQcyvA4LstDY2h16Jh6ay8SEJrMUY';

// Generar token
const header = { alg: 'HS256', typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const payload = {
    file: 'G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\1. Tempoactiva Est SAS\\2. Gestión Integral del SG-SST\\2.1.1 Politica del SG-SST\\GG-OD-001.docx',
    action: 'download',
    iat: now,
    exp: now + 3600
};

function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

const encodedHeader = base64UrlEncode(JSON.stringify(header));
const encodedPayload = base64UrlEncode(JSON.stringify(payload));
const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const token = `${encodedHeader}.${encodedPayload}.${signature}`;

console.log('=== TOKEN GENERADO ===');
console.log(token);
console.log('');
console.log('=== PARTES ===');
const parts = token.split('.');
console.log('Header:', parts[0]);
console.log('Payload:', parts[1]);
console.log('Signature:', parts[2]);
console.log('');
console.log('=== DECODIFICADO ===');
console.log('Header decoded:', Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
console.log('Payload decoded:', Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

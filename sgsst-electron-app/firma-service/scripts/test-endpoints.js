// scripts/test-endpoints.js
// Test de endpoints que muestra la respuesta completa
'use strict';
process.env.NODE_ENV = 'test';
const { makeApp } = require('../tests/helpers');
const app = makeApp();
const server = app.listen(0, () => {
  const port = server.address().port;
  const http = require('http');
  const opts = { hostname: '127.0.0.1', port, path: '/internal/acuerdo-activo', method: 'GET', headers: { 'X-Internal-API-Key': 'test-internal-api-key-32-bytes-min!!' } };
  const req = http.request(opts, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      console.log('=== /internal/acuerdo-activo ===');
      console.log('STATUS:', res.statusCode);
      console.log('BODY:', body);
      // Probar el endpoint de sign request individual
      const opts2 = { hostname: '127.0.0.1', port, path: '/internal/sign-requests/SIGN-2026-112173', method: 'GET', headers: { 'X-Internal-API-Key': 'test-internal-api-key-32-bytes-min!!' } };
      const req2 = http.request(opts2, (res2) => {
        let body2 = '';
        res2.on('data', d => body2 += d);
        res2.on('end', () => {
          console.log('\n=== /internal/sign-requests/SIGN-2026-112173 ===');
          console.log('STATUS:', res2.statusCode);
          console.log('BODY:', body2.substring(0, 800) + (body2.length > 800 ? '...' : ''));
          server.close();
        });
      });
      req2.on('error', e => { console.error('err2:', e.message); server.close(); });
      req2.end();
    });
  });
  req.on('error', e => { console.error('err:', e.message); server.close(); });
  req.end();
});

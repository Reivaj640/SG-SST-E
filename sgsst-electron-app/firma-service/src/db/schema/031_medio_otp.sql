-- =============================================================================
-- Migración 031: el medio del OTP es otro canal que el de la invitación
-- =============================================================================
-- ESTA MIGRACIÓN ES ADITIVA (no breaking para datos existentes). Solo añade
-- dos columnas. No cambia el comportamiento de nada: el rechazo (D2) sigue
-- APAGADO (ver `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`).
--
-- EL PROBLEMA QUE RESUELVE
-- -----------------------
-- Hoy `correo_verificacion` cumple DOS papeles distintos:
--
--   1. A dónde va la INVITACIÓN (que lleva el token de acceso).
--   2. A dónde va el OTP (que es el dato de creación de la firma).
--
-- Y la app de escritorio lo precarga con el correo del trabajador que tiene
-- en el registro de la Empresa: en la práctica, el OTP le llega a un buzón
-- que la Empresa puede leer.
--
-- El artículo 2.2.2.47.4 num. 1 dice que "los datos de creación de la firma,
-- en el contexto en que son utilizados, corresponden exclusivamente al
-- firmante". Un OTP entregado a un buzón de la Empresa rompe esa condición
-- en el contexto en que se usa (el 47.4 exige poder probabilisticamente
-- separar los roles en la arquitectura del producto).
--
-- LA DECISIÓN (owner, 2026-10-20)
-- -------------------------------
-- Separar los dos canales:
--
--   - La INVITACIÓN (el token) sigue yendo al contacto registrado por la
--     Empresa. En el contexto de uso no es un factor: sin el OTP no se
--     firma.
--   - El OTP (dato de creación) va a un medio PERSONAL del Trabajador, que
--     declara él mismo en la mini-app. Si la Empresa puede leer ese buzón,
--     también puede leer el código, y entonces la garantía del 47.4 (y la
--     del 6.1(d)) serían falsas.
--
-- POR QUÉ UNA COLUMNA Y NO UNA TABLA
-- ---------------------------------
-- `correo_otp` es UN dato por solicitud (el medio que declaró el
-- Trabajador): va en la fila. Los dominios corporativos son de la EMPRESA y
-- son un dato de política: van en su ficha, como el resto (plazo, canal de
-- copia, canal de PQRS).
--
-- `dominios_corporativos` guarda la lista EXPRESA (separada por comas). Los
-- dominios derivados de los correos que la Empresa ya registró (canal de
-- PQRS, responsable de tratamiento, canal de copia, canal de incidentes) se
-- suman en el servicio: así no depende de que alguien declare bien la lista.
--
-- Tests: tests/d02-medio-otp.test.js
-- =============================================================================

-- 1. El medio personal que declaró el Trabajador para el OTP.
--    NULL = no declaró (se usa el contacto registrado, con la regla del D2).
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN correo_otp TEXT;

-- 2. Los dominios corporativos EXPRESOS de la Empresa.
ALTER TABLE gh_firma_empresas
  ADD COLUMN dominios_corporativos TEXT;

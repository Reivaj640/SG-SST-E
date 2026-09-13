# Servicio de Firma Electrónica K+AIR v1

Backend independiente para firma electrónica de documentos laborales
colombianos. Diseñado conforme al marco normativo aplicable
(Ley 527/1999, Decreto 2364/2012, Decreto 1072/2015, Decreto
526/2021, Ley 1581/2012).

> **Estado**: v0.1 — Esqueleto del servicio + schema SQLite.
> Implementación en curso. **No usar en producción todavía.**

## Arquitectura

Este servicio es **independiente** de K+AIR Electron. Se comunica
con él por HTTP (API REST) y comparte únicamente el contrato de
datos, no la base de datos.

```
K+AIR Electron  ───HTTP───▶  Servicio Firma  ───HTTP───▶  Trabajador
                              (Express + SQLite)         (mini-app web)
```

## Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4
- **BD**: SQLite (better-sqlite3)
- **PDF**: pdf-lib
- **Email**: nodemailer
- **Validación**: zod
- **Seguridad**: helmet, express-rate-limit
- **Crypto**: módulos nativos de Node (no dependencias externas)

## Estructura

```
firma-service/
├── src/
│   ├── server.js          # Entry point
│   ├── config.js          # Configuración desde .env
│   ├── db/
│   │   ├── connection.js  # Singleton SQLite
│   │   ├── migrate.js     # Ejecutor de migraciones
│   │   └── schema/
│   │       └── 001_initial.sql   # 5 tablas + índices
│   ├── middleware/
│   │   ├── requestId.js   # X-Request-Id
│   │   └── errors.js      # Manejador central
│   ├── routes/
│   │   └── health.js      # GET /health
│   └── utils/
│       └── logger.js      # JSON estructurado
├── data/                  # firma.sqlite (gitignored)
├── storage/pdfs/          # PDFs generados (gitignored)
│   ├── originales/
│   ├── firmados/
│   └── constancias/
├── web/firma/             # Mini-app pública (próximamente)
├── tests/                 # Tests (próximamente)
├── .env.example           # Plantilla de configuración
├── package.json
└── README.md
```

## Configuración inicial

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar plantilla de .env
cp .env.example .env

# 3. Generar INTERNAL_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Pegar en .env como INTERNAL_API_KEY

# 4. Configurar SMTP (Gmail con App Password, Mailtrap, MailHog, etc.)

# 5. Ejecutar migraciones
npm run migrate

# 6. Iniciar en desarrollo
npm run dev
```

## Comandos

| Comando | Descripción |
|---|---|
| `npm start` | Inicia el servidor en producción. |
| `npm run dev` | Inicia con `--watch` (recarga en cambios). |
| `npm run migrate` | Ejecuta migraciones pendientes. |
| `npm test` | Ejecuta los tests. |

## Endpoints implementados (v0.1)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | público | Healthcheck (verifica BD + SMTP config). |

## Endpoints pendientes (próximas iteraciones)

Ver `docs/gestion-humana/firma-electronica/API.md` para el contrato
completo. Por implementar:

- `POST /internal/acuerdo-activo`
- `POST /internal/consentimientos`
- `POST /internal/consentimientos/:id/verify-otp`
- `POST /internal/sign-requests` (crear solicitud con PDF)
- `GET /internal/sign-requests/:id`
- `GET /s/{token}` (mini-app)
- `POST /api/sign/{token}/identify`
- `POST /api/sign/{token}/verify-otp`
- `POST /api/sign/{token}/view-document`
- `POST /api/sign/{token}/commit`
- `POST /api/sign/{token}/reject`
- y más...

## Documentación de diseño

Toda la arquitectura está documentada en:
`../docs/gestion-humana/firma-electronica/`

- `ARCHITECTURE.md` — Documento maestro
- `DATA_MODEL.md` — Modelo de datos (fuente de verdad para el schema)
- `API.md` — Contratos request/response
- `FLOWS.md` — Diagramas de secuencia
- `SECURITY.md` — Análisis STRIDE
- `LEGAL.md` — Marco normativo

## Pendiente de validación jurídica

El sistema **NO debe usarse en producción con trabajadores reales**
hasta que un abogado laboral colombiano valide:

- Texto del Acuerdo de uso (§4 de LEGAL.md)
- Manifestación de voluntad (§5 de LEGAL.md)
- Plazo de retención documental (§7 de LEGAL.md)
- Política de protección de datos (§8 de LEGAL.md)

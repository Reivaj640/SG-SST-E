/**
 * Schemas de validación con zod.
 *
 * Ver API.md §6.9, §6.10, §6.11.
 */
'use strict';

const { z } = require('zod');
const { TIPOS_IDENTIFICACION } = require('../services/signRequest');  // I-002: single source of truth
const { CATEGORIAS: CATALOGO_RETENCION } = require('../services/retencion');  // 033

// Los ids del catálogo de retención por documento. Es la lista que la API
// acepta: un id fuera de esta lista se rechaza con 400 (no se inventa un
// plazo ni se cae a la tabla de la Empresa por un valor mal escrito).
const CATEGORIAS_RETENCION = Object.freeze(
  CATALOGO_RETENCION.map((c) => c.id)
);

/**
 * Schema del body de POST /internal/consentimientos.
 *
 * Ver API.md §6.10.
 */
const createConsentBody = z.object({
  id_trabajador: z.string().min(1).max(64),
  id_empresa: z.string().min(1).max(64),
  version_acuerdo: z.string().min(1).max(32),
  correo_verificacion: z.string().email().max(254),
  kair_version: z.string().min(1).max(32),
});

/**
 * Schema del body de POST /internal/consentimientos/:id/verify-otp.
 *
 * Ver API.md §6.11.
 */
const verifyOtpBody = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP debe ser 6 dígitos numéricos'),
  kair_version: z.string().min(1).max(32).optional(),
});

/**
 * Schema del body de POST /internal/consentimientos/:id/expire
 * (FASE 3 · A1.5.4-B).
 *
 * Auth: X-Admin-API-Key (operación humana, NO expuesta a K+AIR).
 *
 * Ver API.md §6.12.
 */
const expireConsentBody = z.object({
  motivo: z.string()
    .min(10, 'motivo debe tener al menos 10 caracteres')
    .max(500, 'motivo debe tener máximo 500 caracteres')
    .refine(
      (v) => v.trim().length >= 10,
      'motivo no puede ser solo espacios en blanco',
    ),
  actor: z.string()
    .min(1, 'actor es requerido')
    .max(100, 'actor debe tener máximo 100 caracteres'),
}).strict();

/**
 * Schema del campo 'metadata' (JSON) en POST /internal/sign-requests.
 * Se valida como JSON string; el service lo parsea.
 *
 * Ver API.md §6.1.
 */
const signRequestMetadata = z.string()
  .max(8192)
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'metadata debe ser JSON válido' },
  );

/**
 * Schema de los campos no-file en POST /internal/sign-requests.
 *
 * Ver API.md §6.1.
 */
const signRequestBody = z.object({
  id_documento: z.string().min(1).max(128),
  id_trabajador: z.string().min(1).max(64),
  id_empresa: z.string().min(1).max(64),
  tipo_firma: z.enum(['presencial', 'remoto']),
  // agreement_version: identifica la versión del Acuerdo que el cliente afirma usar.
  // Es OBLIGATORIO: cada sign request debe quedar vinculado server-side a una
  // versión publicada en gh_firma_acuerdo_versiones. La validación de existencia,
  // activación, vigencia y coincidencia de hash se hace en services/signRequest.js.
  agreement_version: z.string().min(1).max(32),
  agreement_hash: z.string().regex(/^[0-9a-f]{64}$/, 'agreement_hash debe ser SHA-256 hex'),
  document_hash: z.string().regex(/^[0-9a-f]{64}$/, 'document_hash debe ser SHA-256 hex'),
  // I-103.A1.6.C · RF-FIRMA-CORREO-01: correo del firmante persistido
  // explícitamente en gh_firmas_electronicas.correo_verificacion al crear
  // la solicitud. Es la fuente de verdad para INVITE, OTP inicial y reenvíos
  // de OTP. Optional por retrocompatibilidad (SRs legacy sin este campo
  // caen al fallback de metadata.correo / consent.correo_verificacion).
  correo_verificacion: z.string().email().max(254).optional(),
  // D-2 · El correo PERSONAL al que va el código de verificación (el dato de
  // creación de la firma, 47.4 num. 1). La app de escritorio usa UN solo
  // correo para la invitación y el OTP cuando la Empresa no tiene buzones
  // corporativos; el trabajador puede corregirlo en la mini-app antes de que
  // el código se envíe.
  //
  // Se acepta la cadena vacía por compatibilidad con versiones anteriores de
  // la app que mandaban el campo sin diligenciar; el service la interpreta
  // como "sin medio declarado" y cae al contacto registrado.
  correo_otp: z.union([z.literal(''), z.string().email().max(254)]).optional(),
  // `ttl_horas` se ACEPTA pero el servidor lo IGNORA: la vigencia del
  // enlace la calcula el servicio según la modalidad (remoto 72 h,
  // presencial 24 h), porque el numeral 3.4(c) del Acuerdo la fija. Antes
  // K+AIR mandaba 24 en una firma remota y el rótulo de la consola decía
  // "vence en 24 horas", en contradicción con la fila y con el Acuerdo.
  // Se mantiene el campo en el esquema por compatibilidad con clientes
  // viejos; el valor real llega en la respuesta, `fecha_expiracion`.
  ttl_horas: z.coerce.number().int().min(1).max(168).optional(),
  version_kair: z.string().min(1).max(32),
  identificacion_tipo: z.enum(['CC', 'CE', 'TI', 'PPT', 'PA']).optional(),
  identificacion_numero_hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  // Campos visibles para la Constancia. No afectan evidence_hash; solo
  // alimentan la legibilidad humana del certificado.
  nombre_trabajador: z.string().max(255).optional(),
  nombre_empresa: z.string().max(255).optional(),
  // P1-2: sal aleatoria por sign request para hashear la cédula.
  //   hash = SHA-256(sal || numero_documento)
  // Si el cliente no la envía, el servicio genera una automáticamente.
  // 32 bytes hex = 64 chars.
  identificacion_numero_sal: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  // consent_id (Bloque E6): vínculo con gh_consentimientos_firma.id.
  // Opcional a nivel schema; la obligatoriedad REAL depende de
  // signRequest.agreement_version: si está presente, el sign request
  // debe estar vinculado a un consentimiento ACEPTADO del mismo
  // (trabajador, empresa, version_acuerdo). La validación se hace en
  // commit() (services/publicFlow.js).
  consent_id: z.coerce.number().int().positive().optional(),
  // I-002 (D-1, A1/A2, migration 007): categoría del documento que se firma.
  // DISTINTO de `identificacion_tipo` (CC, CE, TI, PPT, PA) que es el
  // tipo de documento de IDENTIFICACIÓN del firmante. Esta columna es
  // sobre el documento que se está FIRMANDO (categoría legal/administrativa).
  // Valores en TIPOS_IDENTIFICACION (single source of truth en signRequest.js).
  // Opcional en v1: si K+AIR no lo envía, queda NULL (compatibilidad con
  // sign requests legacy pre-migration 007).
  tipo_identificacion: z.enum(TIPOS_IDENTIFICACION).optional(),
  // 033 · CATÁLOGO DE RETENCIÓN POR DOCUMENTO.
  //
  // `categoria_retencion` dice de qué tipo de documento se trata, para que el
  // plazo sea el que corresponde a ESE documento y no el único plazo de la
  // tabla de la Empresa. Ejemplos: una inducción se conserva 20 años desde el
  // cese (2.2.4.6.13 del Decreto 1072); un contrato electrónico se conserva
  // sin término (2.2.1.1.12).
  //
  // Opcional: si no viene, el servidor lo deriva de `tipo_identificacion` +
  // `subtipo_identificacion`, y si tampoco hay datos la solicitud queda como
  // legacy (tabla de la Empresa, texto vivo).
  categoria_retencion: z.enum(CATEGORIAS_RETENCION).optional(),
  // `fecha_terminacion`: el cese de la relación laboral (SST) o el retiro
  // (historia laboral). Es la base de los 20 y de los 100 años. Si falta, la
  // fila queda PENDIENTE (sin fecha de supresión): no se inventa.
  fecha_terminacion: z.union([
    z.literal(''),
    z.string().max(40),
  ]).optional(),
  // `subtipo_identificacion`: texto libre que ajuda a derivar la categoría
  // cuando el cliente no manda la explícita (ej. "induccion").
  subtipo_identificacion: z.string().min(1).max(120).optional(),
  // 8B · El correo de la Empresa a donde se pide la copia del documento
  // firmado (el canal de copia del 8.4/8.5).
  //
  // La app de escritorio YA lo mandaba (sites `documentos` y
  // `firma-electronica`), pero el esquema no lo declaraba: zod lo eliminaba
  // en silencio y nunca llegaba a la base. La constancia lo lee del metadata
  // persistido (routes/constancia.js), así que el canal de copia salía
  // vacío. Ese silencio ya costó datos una vez; por eso el esquema es
  // `.strict()` (abajo) y lo desconocido se rechaza en vez de perderse.
  //
  // Se acepta la CADENA VACÍA a propósito: la app inicializa este campo en
  // '' y lo reasigna al correo del representante cuando hay firma dual
  // (`firma-electronica/index.js`). Con `z.string().email()` a secas, cada
  // firma de ese site caería en un 400. El campo vacío significa "no hay
  // canal de copia declarado" y la constancia cae al snapshot del
  // representante (routes/constancia.js).
  correo_empresa: z.union([z.literal(''), z.string().email().max(254)]).optional(),
  // 8B · LA DECLARACIÓN DE LA EMPRESA SOBRE EL DATO SENSIBLE (numeral 10.8).
  //
  // `datos_sensibles`: la Empresa declara que el documento contiene
  // información de salud. El sistema ADEMÁS lo infiere del tipo de documento
  // (services/sensibles.js): la Empresa puede subir la clasificación, no
  // bajarla. La razón está en el comentario de aquel archivo: el sistema no
  // puede leer el PDF, y no declarar algo sensible es la forma habitual de
  // que un dato sensible se trate sin base legal.
  //
  // `categorias_datos_sensibles`: de qué datos se trata, concretamente. El
  // 10.8(a) exige informar de "cuáles son los datos". Si la Empresa no las
  // declara, se usan las que el tipo implica.
  //
  // `base_legal_sensible`: 'autorizacion_expresa' (la del 10.8(c), que es la
  // del sistema) u 'otra'. Con 'otra', la descripción es obligatoria: el
  // 10.8(c) exige que la Empresa informe de la base ANTES de recoger el
  // dato, y no se puede informar de una base sin decir cuál es.
  //
  // `finalidad_sensible`: la finalidad del tratamiento. El sistema conoce la
  // suya (levantar la firma) y esta la puede precisar la Empresa.
  //
  // El booleano acepta 1 y 0 porque la app manda números en algunos campos
  // (mismo criterio que `requiere_firma_empresa`).
  datos_sensibles: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  categorias_datos_sensibles: z.array(z.string().min(1).max(120)).max(12).optional(),
  base_legal_sensible: z.enum(['autorizacion_expresa', 'otra']).optional(),
  base_legal_sensible_descripcion: z.string().min(1).max(500).optional(),
  finalidad_sensible: z.string().min(1).max(300).optional(),
  // I-FIRMA-DUAL (migration 013, v0.1.180): opt-in para que el commit()
  // del worker dispare automáticamente un sign request hijo (tipo_firmante='EMPRESA')
  // para que firme el representante legal. Si requiere_firma_empresa=1, el route
  // exige representante_legal_snapshot (validación inline en signRequest.js).
  // .optional() por compat: sign requests legacy NO pasan estos campos.
  requiere_firma_empresa: z.union([z.literal(0), z.literal(1)]).optional(),
  // El snapshot del representante guarda datos de una persona (nombre,
  // identificación, correo). Lo que no está declarado no se guarda: una
  // clave desconocida aquí sería un dato personal extra archivado sin que
  // nadie lo pidiera.
  representante_legal_snapshot: z.object({
    nombre: z.string().min(1),
    tipo_identificacion: z.enum(['CC', 'CE', 'TI', 'PPT', 'PA']),
    numero_identificacion: z.string().min(4).max(20),
    correo: z.string().email(),
    cargo: z.string().optional(),
  }).strict().optional(),
  metadata: signRequestMetadata,
  // 8B · `.strict()`: una clave desconocida se RECHAZA (400 con el nombre de
  // la clave), no se elimina en silencio.
  //
  // Antes el esquema hacía strip: el cliente podía mandar campos que nadie
  // leía y nadie se enteraba. `correo_empresa` es la prueba de que ese
  // silencio cuesta datos (se perdió durante meses y la constancia salía
  // sin el canal de copia). Rechazar es más ruidoso que perder el dato, y el
  // error dice exactamente qué clave sobró.
  //
  // La lista blanca de lo que se PERSISTE (el metadata libre) es otra cosa
  // y vive en routes/signRequest.js: el string JSON de `metadata` se parsea
  // y se filtra antes de archivarse.
}).strict();

/**
 * Schema de query params para GET /internal/sign-requests.
 */
const signRequestListQuery = z.object({
  id_empresa: z.string().max(64).optional(),
  estado: z.union([z.string(), z.array(z.string())]).optional(),
  id_trabajador: z.string().max(64).optional(),
  id_documento: z.string().max(128).optional(),
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Schema del body de POST /internal/sign-requests/:id/notify-remote
 * (I-103.A1.5.1: enviar invitación al firmante).
 *
 * Ver docs/gestion-humana/firma-electronica/API.md §6.X.
 */
const signRequestNotifyBody = z.object({
  // Correo del firmante. Validado como email (RFC 5322 simplificado por zod).
  // z.string().email() rechaza 'foo@bar' (sin TLD) y similares — suficiente
  // para v1. Si el SMTP rebota, publicFlow.identify() caerá al placeholder
  // 'trabajador@ejemplo.com' (ver §"Por ahora, usamos un placeholder" en
  // publicFlow.js). La UI debe pre-validar antes de enviar.
  correo: z.string().email().max(254),
  // Metadata libre: lo que el caller quiera pasar para auditoría
  // (ej. { ip_origen: '...', user_agent: '...' }). NO se loggea en plaintext.
  // Cap de 20 keys y 4KB total para evitar abuse.
  context: z.record(z.string().max(256), z.unknown())
    .refine(
      (v) => Object.keys(v).length <= 20,
      { message: 'context tiene más de 20 keys' },
    )
    .optional(),
  // 8C · El token que el cliente ya tenía (opcional).
  //
  // Si viene, la invitación se envía con ESE enlace: no se emite un token
  // nuevo y no se gasta un cupo de rotación. Si no viene, el servicio emite
  // uno nuevo (rotación) y lo manda en el correo.
  //
  // El token se valida contra la solicitud: si el que llega no es de esta
  // solicitud, la respuesta es 409 TOKEN_MISMATCH. No se acepta un token de
  // otra parte para construir el enlace de esta.
  token: z.string().max(256).optional(),
});

/**
 * Schema del body de POST /internal/sign-requests/:id/link/rotate (8C).
 *
 * `motivo` es lo que queda escrito en el registro del token emitido: por qué
 * se emitió. `revocar_anteriores` revoca los tokens vivos antes de emitir el
 * nuevo (el que se usa cuando la Empresa quiere que el enlace anterior deje
 * de funcionar).
 */
const signRequestRotateBody = z.object({
  motivo: z.string().max(200).optional(),
  revocar_anteriores: z.boolean().optional(),
});

/**
 * Schema del body de POST /internal/sign-requests/:id/suministro-autoridad
 * (la 9A, el 8.4).
 *
 * El asiento del suministro a una autoridad judicial o de inspección,
 * vigilancia y control tiene que decir QUIÉN lo pidió, a QUIÉN se le
 * entregó y con qué radicado. Sin esos tres datos, el asiento no prueba
 * nada.
 */
const suministroAutoridadBody = z.object({
  autoridad: z.string().min(3).max(200),
  radicado: z.string().max(120).optional(),
  destinatario: z.string().max(200).optional(),
  pdf_sha256: z.string().max(64).optional(),
});

/**
 * Schema de query params para GET /internal/sign-requests?ids=batch (I-008).
 *
 * Acepta `ids` como string separado por comas. Cada id puede ser
 * `SIGN-YYYY-NNNNNN` o entero positivo. Máximo 200 ids (control de carga
 * para no permitir batches gigantes que agoten la BD).
 *
 * Si `ids` no viene → 400 INVALID_REQUEST_BODY.
 * Si después de trim/filter la lista está vacía → 400 INVALID_REQUEST_BODY.
 * Si algún id no matchea los formatos permitidos → 400 INVALID_REQUEST_BODY
 *   con details.invalid_ids para que K+AIR sepa cuáles rechazó.
 */
const signRequestIdsQuery = z.object({
  ids: z.string()
    .min(1, 'ids es requerido')
    .max(20000, 'ids demasiado largo (máx 20000 chars)')
    .refine(
      (v) => {
        const parts = v.split(',').map(s => s.trim()).filter(Boolean);
        return parts.length > 0;
      },
      { message: 'ids no puede estar vacío' },
    )
    .refine(
      (v) => {
        const parts = v.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length > 200) return false;
        return parts.every(p => /^SIGN-\d{4}-\d{6}$/.test(p) || /^\d+$/.test(p));
      },
      { message: 'ids contiene entradas inválidas o más de 200 ids' },
    ),
});

/**
 * Schema del body de POST /api/sign/:token/resend-otp
 *
 * Body vacío (resend no necesita parámetros adicionales).
 * El token en la URL es la credencial.
 */
const resendOtpBody = z.object({});

/**
 * Schema del body de POST /api/sign/:token/consent/sensible (8B).
 *
 * `autoriza` es lo que el Titular marcó en la casilla SEPARADA del aviso de
 * dato sensible (el 10.8(a)). Puede ser `false`: el Titular NO está
 * obligado a autorizar su tratamiento, y esa decisión también se registra.
 */
const consentSensibleBody = z.object({
  autoriza: z.boolean(),
});

module.exports = {
  createConsentBody,
  verifyOtpBody,
  expireConsentBody,  // FASE 3 · A1.5.4-B: admin expire
  signRequestBody,
  signRequestListQuery,
  signRequestIdsQuery,  // I-008: batch query
  signRequestNotifyBody,  // I-103.A1.5.1: notify-remote
  signRequestRotateBody,  // 8C: link/rotate
  suministroAutoridadBody,  // 9A: el 8.4 (suministro a autoridades)
  consentSensibleBody,  // 8B: consentimiento expreso del dato sensible (10.8)
  resendOtpBody,
};

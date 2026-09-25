// test-hf-llm-canales.js
//
// Test de humo de la Tarea 4 (Fase 4 — tests): LLM de Investigación de AT
// recableado al GGUF privado de HuggingFace.
//
// Valida:
//   A. Contrato de canales hf-* y llm-* en preload.js
//   B. Handlers IPC hf-*/llm-* en investigacion_handlers.js (token por
//      header X-HF-Token, nunca crudo al renderer, guards sin token)
//   C. Endpoints Flask /hf/list|/hf/download|/hf/progress con X-HF-Token
//   D. Payload de inferencia respeta la config guardada
//      (llmSystemPrompt / llmTemperature / llmMaxTokens) y no trae
//      default silencioso qwen-inv-at
//   E. Sección HF en Configuración › IA (UI + JS)
//   F. Sin restos de setup_ollama / Modelfile de Ollama legacy
//
// Ejecución:  node tests/investigacion-accidentes/test-hf-llm-canales.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const F_PRELOAD = path.join(ROOT, 'preload.js');
const F_HANDLERS = path.join(ROOT, 'modules', 'gestion-salud',
  'investigacion-accidentes', 'investigacion_handlers.js');
const F_SERVER = path.join(ROOT, 'Portear', 'src', 'llm_server.py');
const F_INVEST = path.join(ROOT, 'Portear', 'src', 'Invest_APP_V_3.py');
const F_CONFIG = path.join(ROOT, 'components', 'config', 'config-viewer.html');

const preload = fs.readFileSync(F_PRELOAD, 'utf8');
const handlers = fs.readFileSync(F_HANDLERS, 'utf8');
const server = fs.readFileSync(F_SERVER, 'utf8');
const invest = fs.readFileSync(F_INVEST, 'utf8');
const config = fs.readFileSync(F_CONFIG, 'utf8');

const checks = [];
function check(name, ok, extra) {
  checks.push({ name: name, ok: !!ok, extra: extra });
}

/* ══════════════ A. CONTRATO PRELOAD (hf-* y llm-*) ══════════════ */

const preloadHf = [
  ['hfListRepos', 'hf-list-repos'],
  ['hfListModels', 'hf-list-models'],
  ['hfDownloadModel', 'hf-download-model'],
  ['hfDownloadStatus', 'hf-download-status'],
  ['hfSaveToken', 'hf-save-token'],
  ['hfGetToken', 'hf-get-token'],
  ['hfRemoveToken', 'hf-remove-token']
];
preloadHf.forEach(function (p) {
  check('preload: ' + p[0] + ' → ' + p[1],
    new RegExp(p[0] + '\\s*:\\s*\\([^)]*\\)\\s*=>\\s*ipcRenderer\\.invoke\\(\'' + p[1] + '\'')
      .test(preload));
});

const preloadLlm = [
  ['llmGetConfig', 'llm-get-config'],
  ['llmSaveConfig', 'llm-save-config']
];
preloadLlm.forEach(function (p) {
  check('preload: ' + p[0] + ' → ' + p[1],
    new RegExp(p[0] + '\\s*:\\s*\\([^)]*\\)\\s*=>\\s*ipcRenderer\\.invoke\\(\'' + p[1] + '\'')
      .test(preload));
});

/* ══════════════ B. HANDLERS IPC (main) ══════════════ */

const handlerHf = [
  'hf-save-token', 'hf-get-token', 'hf-remove-token',
  'hf-list-repos', 'hf-list-models', 'hf-download-model', 'hf-download-status'
];
handlerHf.forEach(function (h) {
  check('handlers: ipcMain.handle(\'' + h + '\') existe',
    handlers.indexOf('ipcMain.handle(\'' + h + '\'') !== -1);
});

const handlerLlm = ['llm-get-config', 'llm-save-config', 'llm-list-models', 'llm-select-model'];
handlerLlm.forEach(function (h) {
  check('handlers: ipcMain.handle(\'' + h + '\') existe',
    handlers.indexOf('ipcMain.handle(\'' + h + '\'') !== -1);
});

// Token viaja SOLO como header X-HF-Token hacia Flask
check('handlers: hf-list manda token por header X-HF-Token',
  /\/hf\/list'[^\n]*'X-HF-Token':\s*token/.test(handlers));
check('handlers: hf-download manda token por header X-HF-Token',
  /\/hf\/download'[^\n]*'X-HF-Token':\s*token/.test(handlers));
check('handlers: sin token guardado → error claro (list)',
  handlers.indexOf('Guarda tu token de HuggingFace primero') !== -1);

// Nunca devolver el token crudo al renderer
check('handlers: hf-get-token devuelve SOLO máscara (tokenMasked)',
  /ipcMain\.handle\('hf-get-token'[\s\S]{0,400}tokenMasked:\s*_maskToken\(token\)/.test(handlers));
check('handlers: helper _maskToken definido',
  /function _maskToken\(/.test(handlers));
check('handlers: hf-save-token valida longitud mínima',
  /hf-save-token[\s\S]{0,400}trim\(\)\.length\s*<\s*8/.test(handlers));
check('handlers: token cifrado en secrets.enc (safeStorage)',
  /function _hfSecretsPath\(\)[\s\S]{0,200}secrets\.enc/.test(handlers) &&
  /safeStorage\.encryptString/.test(handlers));

// Sin auto-start eager del servidor LLM (lazy bajo demanda)
check('handlers: auto-start del servidor LLM es lazy (sin initialize eager)',
  /Auto-start LAZY/.test(handlers));
check('handlers: ruta del script LLM resuelve process.resourcesPath en prod',
  /process\.resourcesPath/.test(handlers) &&
  /function getLlmServerScriptPath\(\)/.test(handlers));
check('handlers: handler muerto investigacion-accidentes-get-config eliminado',
  handlers.indexOf('investigacion-accidentes-get-config') === -1);

// ECONNREFUSED 127.0.0.1:5555 — los handlers de Configuración encienden Flask
// antes de pedirle algo (el auto-start lazy del análisis no los cubre)
check('handlers: helper ensureLlmServerUp definido',
  /async function ensureLlmServerUp\(\)/.test(handlers));
check('handlers: ensureLlmServerUp NO espera modelo cargado (usa probeLlmServer)',
  /async function ensureLlmServerUp\(\)[\s\S]{0,900}probeLlmServer\(\)/.test(handlers) &&
  !/ensureLlmServerUp\(\)[\s\S]{0,900}checkLlmServerHealth/.test(handlers));
check('handlers: ensureLlmServerUp evita doble spawn (llmServerUpPromise)',
  /llmServerUpPromise/.test(handlers));
const ensureList = [
  'llm-list-models', 'llm-select-model', 'llm-get-config', 'llm-save-config',
  'hf-list-repos', 'hf-list-models', 'hf-download-model', 'hf-download-status'
];
let ensureAll = true;
ensureList.forEach(function (h) {
  // Recortar desde la declaración del handler hasta el SIGUIENTE handler
  const start = handlers.indexOf("ipcMain.handle('" + h + "'");
  const next = handlers.indexOf("ipcMain.handle('", start + 10);
  const body = start === -1 ? '' : handlers.slice(start, next === -1 ? undefined : next);
  const iEnsure = body.indexOf('ensureLlmServerUp()');
  const iReq = body.indexOf('llmServerRequest(');
  if (iEnsure === -1 || (iReq !== -1 && iEnsure > iReq)) {
    ensureAll = false;
    check('handlers: ' + h + ' llama ensureLlmServerUp antes de llmServerRequest', false);
  }
});
check('handlers: los ' + ensureList.length + ' handlers llm/hf encienden Flask antes de pedir',
  ensureAll);
check('handlers: llm-list-models además asegura Ollama (/models lo consulta)',
  /ipcMain\.handle\('llm-list-models'[\s\S]{0,300}ensureOllamaRunning\(\)/.test(handlers));
check('handlers: hf-download-model además asegura Ollama (ollama create)',
  /ipcMain\.handle\('hf-download-model'[\s\S]{0,400}ensureOllamaRunning\(\)/.test(handlers));

/* ══════════════ C. SERVIDOR FLASK (endpoints HF) ══════════════ */

check('server: endpoint /hf/list definido',
  /@app\.route\("\/hf\/list",\s*methods=\["POST"\]\)/.test(server));
check('server: endpoint /hf/download definido',
  /@app\.route\("\/hf\/download",\s*methods=\["POST"\]\)/.test(server));
check('server: endpoint /hf/progress definido',
  /@app\.route\("\/hf\/progress",\s*methods=\["GET"\]\)/.test(server));
check('server: endpoint /hf/repos definido (selector de repo)',
  /@app\.route\("\/hf\/repos",\s*methods=\["GET"\]\)/.test(server));
check('server: /hf/repos exige X-HF-Token (401 si falta)',
  /def hf_repos_endpoint[\s\S]{0,400}Se requiere X-HF-Token/.test(server));
check('server: /hf/repos identifica la cuenta con whoami y lista sus modelos',
  /def hf_repos_endpoint[\s\S]{0,800}whoami\(/.test(server) &&
  /def hf_repos_endpoint[\s\S]{0,900}list_models\(author=/.test(server));
check('server: repo efectivo = pedido > config llmHfRepo > default',
  /def _hf_effective_repo\(/.test(server) &&
  /_hf_effective_repo\(payload\.get\("repo_id"\)\)/.test(server) &&
  (server.match(/_hf_effective_repo\(payload\.get\("repo_id"\)\)/g) || []).length === 2);
check('server: update_llm_config persiste llmHfRepo',
  /if "llmHfRepo" in cfg:\s*\n\s*current\["llmHfRepo"\]/.test(server));
check('server: /hf/list exige X-HF-Token (401 si falta)',
  /\/hf\/list[\s\S]{0,600}Se requiere X-HF-Token/.test(server));
check('server: /hf/download exige X-HF-Token (401 si falta)',
  /\/hf\/download[\s\S]{0,600}Se requiere X-HF-Token/.test(server));
check('server: repo privado por defecto correcto',
  /_HF_DEFAULT_REPO\s*=\s*"Reivaj640\/qwen3\.5-0\.8b-ia-v1"/.test(server));
check('server: descarga con hf_hub_download a <userData>/hf-models',
  /hf_hub_download\(/.test(server) && /hf-models/.test(server));
check('server: job crea Modelfile temporal + ollama create',
  /Modelfile\./.test(server) && /\[ollama,\s*"create",\s*tag,\s*"-f",\s*modelfile\]/.test(server));
check('server: el tag del modelo lleva la versión del repo (v1 y v2 no colisionan)',
  /def _hf_model_tag\(filename: str, repo_id: str = ""\)/.test(server) &&
  /_hf_model_tag\(filename, repo_id\)/.test(server) &&
  /def _hf_repo_tag_suffix\(repo_id: str\)/.test(server));
check('server: sufijo del tag = -vN si el repo termina en -vN, si no nombre sanitizado',
  /r"-v\(\\d\+\)\$"/.test(server) && /hf-\{tag\}\{_hf_repo_tag_suffix\(repo_id\)\}/.test(server));
check('server: al terminar activa el modelo y persiste llmModel',
  /set_current_model_name\(tag\)/.test(server) &&
  /update_llm_config\(\{"llmModel":\s*tag\}\)/.test(server));
check('server: progreso expuesto por job_id',
  /job_id.*request\.args\.get\("job_id"\)/.test(server));
check('server: el token NO se escribe en config.json',
  !/update_llm_config\(\{[^}]*[Tt]oken/.test(server) &&
  !/"hfToken"/.test(server));
check('server: el token NO se registra en logs',
  !/logger\.[a-z]+\(f?"[^"]*\{token\}/.test(server) &&
  !/logger\.[a-z]+\([^)]*token=/i.test(server));

/* ══════════════ D. PAYLOAD DE INFERENCIA (config guardada) ══════════════ */

// analyze: lee get_llm_config() y arma el payload con system/temperature/num_predict
check('server: analyze() lee get_llm_config()',
  /def analyze_via_ollama\([\s\S]{0,3000}llm_cfg\s*=\s*get_llm_config\(\)/.test(server));
check('server: analyze() usa llmSystemPrompt de la config',
  /llm_cfg\.get\("llmSystemPrompt"\)\s+or\s+SYSTEM_PROMPT/.test(server));
check('server: analyze() usa llmTemperature de la config',
  /float\(llm_cfg\.get\("llmTemperature",\s*0\.1\)\)/.test(server));
check('server: analyze() usa llmMaxTokens de la config (num_predict)',
  /int\(llm_cfg\.get\("llmMaxTokens",\s*1216\)\)/.test(server) &&
  /"num_predict":\s*max_tokens/.test(server));

// /regenerate: idem
check('server: /regenerate lee get_llm_config()',
  /@app\.route\("\/regenerate"[\s\S]{0,2500}llm_cfg\s*=\s*get_llm_config\(\)/.test(server));
check('server: /regenerate usa temperature y num_predict de la config',
  /regen_temperature\s*=\s*float\(llm_cfg\.get\("llmTemperature"/.test(server) &&
  /"num_predict":\s*regen_max_tokens/.test(server));

// Muestreo del entrenamiento (Qwen3.5-0.8b-ia): temp 0.1, top_p 0.8,
// top_k 20, min_p 0, repeat_penalty 1.15, presence_penalty 0.
check('server: defaults llmTemperature 0.1 (entrenamiento)',
  /"llmTemperature":\s*0\.1/.test(server));
check('server: options con top_p 0.8 + top_k 20 + min_p 0',
  (server.match(/"top_p":\s*0\.8,\s*"top_k":\s*20,\s*"min_p":\s*0,/g) || []).length >= 2);
check('server: options con repeat_penalty 1.15 + presence_penalty 0',
  (server.match(/"repeat_penalty":\s*1\.15,\s*"presence_penalty":\s*0,/g) || []).length >= 2);
check('server: Modelfile HF con los parámetros del entrenamiento',
  /PARAMETER temperature 0\.1/.test(server) &&
  /PARAMETER top_p 0\.8/.test(server) &&
  /PARAMETER repeat_penalty 1\.15/.test(server) &&
  /PARAMETER presence_penalty 0/.test(server));
check('UI: slider de temperatura inicia en 0.1 (entrenamiento)',
  /id="ai-temp-slider"[^>]*value="0\.1"/.test(config) &&
  /cfg\.llmTemperature !== undefined\) \? cfg\.llmTemperature : 0\.1/.test(config));

// Textos de entrenamiento (verbatim): SYSTEM + plantilla de usuario.
const sysBlock = server.slice(
  server.indexOf('SYSTEM_PROMPT = """'),
  server.indexOf('INSTRUCCIONES_PROMPT')
);
check('server: SYSTEM_PROMPT con reglas exoneración/atribución/incertidumbre',
  sysBlock.length > 100 &&
  /Regla de exoneración/.test(sysBlock) &&
  /Regla de atribución/.test(sysBlock) &&
  /\*\*Regla de incertidumbre/.test(sysBlock) &&
  /Nunca inventes comportamientos/.test(sysBlock));
check('server: SYSTEM_PROMPT sin el prompt viejo de analista experto',
  sysBlock.indexOf('analista experto') === -1 &&
  sysBlock.indexOf('Resolución 0312') === -1);
check('server: plantilla de usuario entrenada (INSTRUCCIONES 5 Porqués COMPLETO)',
  /INSTRUCCIONES: Genera un análisis 5 Porqués COMPLETO/.test(server) &&
  /REGLAS OBLIGATORIAS:\n1\. Genera EXACTAMENTE 5 niveles/.test(server) &&
  /ACCIDENTE A ANALIZAR:"""/.test(server));
check('server: build_user_prompt arma plantilla + datos + cierre entrenado (con ** del dataset v4)',
  /INSTRUCCIONES_PROMPT\s*\+\s*"\\n\\n\*\*Descripción del accidente:\*\*\\n"/.test(server) &&
  /\+ "\\n\\n\*\*Análisis de 5 Porqués:\*\*"/.test(server));
check('server: defaults llmMaxTokens 1216 (entrenamiento)',
  /"llmMaxTokens":\s*1216/.test(server) &&
  (server.match(/"llmMaxTokens",\s*1216/g) || []).length >= 2);
check('UI: slider de tokens en 1216 + reset con el prompt entrenado',
  /id="ai-tokens-slider"[^>]*value="1216"/.test(config) &&
  /cfg\.llmMaxTokens !== undefined\) \? cfg\.llmMaxTokens : 1216/.test(config) &&
  /Regla de exoneración/.test(config) &&
  /const defaultPrompt = `Eres un asistente de investigación de accidentes/.test(config));

// Sin default silencioso + guards claros
check('server: sin default qwen-inv-at',
  server.indexOf('qwen-inv-at') === -1);
check('server: guard "No hay modelo de IA configurado" en analyze',
  /analyze_via_ollama[\s\S]{0,1500}No hay modelo de IA configurado/.test(server));
check('server: guard "No hay modelo de IA configurado" en /load',
  /@app\.route\("\/load"[\s\S]{0,800}No hay modelo de IA configurado/.test(server));
check('server: guard "No hay modelo de IA configurado" en /regenerate',
  /@app\.route\("\/regenerate"[\s\S]{0,3000}No hay modelo de IA configurado/.test(server));
check('server: run_server avisa si no hay modelo configurado',
  /run_server\(\)[\s\S]{0,2000}No hay modelo de IA configurado/.test(server));

// Whitelist de update_llm_config: NUNCA persiste token
check('server: update_llm_config solo persiste campos llm*',
  /for key in \("llmTemperature",\s*"llmMaxTokens",\s*"llmSystemPrompt"\)/.test(server));

// Invest_APP_V_3.py sin default de modelo ni setup_ollama
check('Invest_APP: sin default qwen-inv-at',
  invest.indexOf('qwen-inv-at') === -1);
check('Invest_APP: sin mensajes de setup_ollama',
  invest.indexOf('setup_ollama') === -1);
check('Invest_APP: sin bloque --get-config',
  invest.indexOf('--get-config') === -1);

/* ══════════════ E. SECCIÓN HF EN CONFIGURACIÓN › IA ══════════════ */

const configHfIds = [
  'hf-token-input', 'hf-token-save', 'hf-token-remove', 'hf-token-status',
  'hf-repo-select', 'hf-repo-label', 'hf-models-list', 'hf-list-refresh',
  'hf-progress-wrap', 'hf-progress-fill', 'hf-progress-label'
];
configHfIds.forEach(function (id) {
  check('UI: #' + id + ' presente', config.indexOf('id="' + id + '"') !== -1);
});

check('UI: saveHfToken llama electronAPI.hfSaveToken',
  /function saveHfToken\(\)[\s\S]{0,600}hfSaveToken\(/.test(config));
check('UI: loadHfRepos llena el selector con hfListRepos',
  /function loadHfRepos\(\)[\s\S]{0,900}hfListRepos\(/.test(config));
check('UI: cambio de repo persiste llmHfRepo y recarga la lista',
  /addEventListener\('change'[\s\S]{0,300}llmSaveConfig\(\{\s*llmHfRepo:/.test(config));
check('UI: loadHfModels envía el repo elegido (repo_id)',
  /function loadHfModels\(\)[\s\S]{0,600}payload\.repo_id\s*=\s*_hfCurrentRepo/.test(config));
check('UI: startHfDownload envía el repo elegido (repo_id)',
  /function startHfDownload\([\s\S]{0,700}dlPayload\.repo_id\s*=\s*_hfCurrentRepo/.test(config));
check('UI: el modelo activo se resalta sin importar el sufijo :latest',
  /function _modelBase\([\s\S]{0,200}replace\(\s*\/:latest\$\/,\s*''\s*\)/.test(config) &&
  /\(_modelBase\(name\)\s*===\s*_modelBase\(active\)\)/.test(config));
check('UI: loadHfModels llama electronAPI.hfListModels',
  /function loadHfModels\(\)[\s\S]{0,600}hfListModels\(/.test(config));
check('UI: startHfDownload llama electronAPI.hfDownloadModel',
  /function startHfDownload\([\s\S]{0,600}hfDownloadModel\(/.test(config));
check('UI: polling de descarga usa hfDownloadStatus',
  /hfDownloadStatus\(/.test(config) && /_hfPollTimer/.test(config));
check('UI: token guardado se muestra enmascarado (nunca crudo)',
  /tokenMasked/.test(config) && !/input\.value\s*=\s*r\.token\b/.test(config));
check('UI: navega a la sección IA (navigateToConfigSection)',
  /function navigateToConfigSection\(/.test(config));
check('UI: switchTab refresca el estado del token en tab ia',
  /tabId\s*===\s*'ia'[\s\S]{0,200}loadHfTokenStatus\(\)/.test(config));

/* ══════════════ E2. COHERENCIA UX · A nombre · B subtítulos · C badges ══════════════
   El mismo modelo se mostraba ":latest" en la card y sin sufijo en el dropdown,
   los dos selectores no explicaban su rol y no había forma de saber qué era
   preview (elegido) vs activo (aplicado). */
check('UI (A): la card Estado muestra el nombre SIN :latest',
  /_modelBase\(cfg\.llmModel\)\s*\|\|\s*'—'/.test(config));
check('UI (A): las opciones del dropdown muestran el nombre SIN :latest + "· activo"',
  /_modelBase\(name\)\s*\+\s*\(isActive\s*\?\s*' · activo'\s*:\s*''\)/.test(config));
check('UI (A): el toast de cambio de modelo va SIN :latest',
  /showToast\('Modelo cambiado a: '\s*\+\s*_modelBase\(/.test(config));
check('UI (A): tras aplicar, el nombre activo se normaliza con _modelBase',
  /function applyAIModel\(\)[\s\S]{0,800}_modelBase\(result\.active_model\s*\|\|\s*model\)/.test(config));
check('UI (B): label visible "Repositorio de origen" sobre el selector de repo',
  /for="hf-repo-select"[^>]*>Repositorio de origen<\/label>/.test(config));
check('UI (B): subtítulo de Cambiar Modelo aclara que son locales',
  config.indexOf('Modelos instalados localmente en Ollama') !== -1);
check('UI (B): subtítulo de HuggingFace aclara que son descargas nuevas',
  config.indexOf('Modelos NUEVOS desde tu repositorio de HuggingFace') !== -1);
check('UI (C): badge de vista previa presente en el card Estado',
  config.indexOf('id="ai-model-preview-badge"') !== -1 &&
  /function _updateModelPreviewBadge\(/.test(config));
check('UI (C): badge se actualiza al cargar config, al aplicar y al cambiar selección',
  /function loadAIConfig\(\)[\s\S]{0,900}_updateModelPreviewBadge\(\)/.test(config) &&
  /function applyAIModel\(\)[\s\S]{0,1200}_updateModelPreviewBadge\(\)/.test(config) &&
  /select\.onchange = function[\s\S]{0,500}_updateModelPreviewBadge\(\)/.test(config));
check('UI (C): comparación de preview vs activo normaliza ambos con _modelBase',
  /_modelBase\(select\.value\)\s*!==\s*_modelBase\(_activeModelName\)/.test(config));
check('UI (C): al aplicar un modelo se recarga el dropdown (mueve el "· activo")',
  /showToast\('Modelo cambiado a:[\s\S]{0,400}loadAIModels\(\)/.test(config));

/* ══════════════ F. SIN RESTOS DEL PIPELINE LEGACY ══════════════ */

check('repo: no queda setup_ollama.ps1',
  !fs.existsSync(path.join(ROOT, 'Portear', 'src', 'setup_ollama.ps1')));
check('repo: no queda Modelfile de Ollama legacy',
  !fs.existsSync(path.join(ROOT, 'Portear', 'src', 'Modelfile')));
check('server: sin mensajes que apunten a setup_ollama.ps1',
  server.indexOf('setup_ollama') === -1);
check('server: sin "Mistral" en la documentación inline',
  !/Mistral/i.test(server));
check('requirements: huggingface_hub presente',
  fs.readFileSync(path.join(ROOT, 'Portear', 'requirements.txt'), 'utf8')
    .indexOf('huggingface_hub') !== -1);

/* ══════════════ G. TOPE DE 5 NIVELES (METODOLOGÍA 5 PORQUÉS) ══════════════
   Regresión: el modelo chiquito a veces ignora "EXACTAMENTE 5 niveles" y
   generó hasta 36 (log 2026-09-24 14:59 "Post-procesamiento aplicado a 36
   niveles"). Defensa en el servidor: parser con tope + strip + stop. */
check('server: parse_5_whys descarta niveles fuera de 1-5',
  server.includes('dropped_out_of_range'));
check('server: parseo alternativo corta al encontrar nivel >5',
  /if level_n > 5:\n\s+current_level = None/.test(server));
check('server: strip acota el bloque del nivel 5 al próximo encabezado de nivel',
  server.includes('level5_region'));
check('server: strip toma el MAX entre categorías (Material no se pierde)',
  server.includes('m2.end() > last_category_end'));
check('server: stop sequence "6. ¿Por qué" en analyze, iterativa, reintento y regenerate (4 usos)',
  (server.match(/"stop": \["6\. ¿Por qué"/g) || []).length === 4);
check('server: backward test opera sobre el resultado ya capado (validate después de parse)',
  /parsed_result = parse_5_whys\(analysis_text\)[\s\S]{0,400}_validate_backward_chain\(parsed_result\)/.test(server));
/* ══════════════ H. ANTI-REPETICIÓN + PREGUNTA ENCADENADA (captura 2026-09-24) ══════════════
   Regresión: los niveles 2-5 repetían el mismo texto y el validador daba 98/100
   (el overlap léxico premia lo idéntico) → el reintento con feedback nunca se
   disparaba, y la UI mostraba "¿Por qué? - Nivel N" en vez de la cadena. */
check('server: validador detecta celdas que repiten el nivel anterior (anti-repetición)',
  server.includes('repeated_cells') && server.includes('Cadena estancada'));
check('server: penalización de repetición entra en continuity y en details',
  server.includes('repetition_penalty') && server.includes('continuity_repetition'));
check('server: gate de validez con 6+ celdas repetidas (cadena estancada no aprueba)',
  /len\(repeated_cells\) < 6/.test(server));
check('server: feedback de regeneración prioriza la estancada (issues[0])',
  /issues\.insert\(\s*0,\s*\n?\s*f"Cadena estancada/.test(server));
check('server: _build_pregunta extrae la pregunta real del texto del modelo',
  server.includes('def _build_pregunta') && server.includes('_CAT_SPLIT_RE'));
check('server: _build_pregunta sintetiza la cadena con la causa del nivel anterior',
  server.includes('¿Por qué {causa}?') && server.includes('_build_pregunta(level_n, level_content, result)'));
/* ══════════════ I. CADENA ITERATIVA (captura 2026-09-24 v2) ══════════════
   Regresión: el modelo copia la plantilla LITERAL ("¿Por qué [causa principal
   del nivel 1]?") y repite las mismas causas en los 5 niveles AUNQUE el
   feedback se lo diga explícito (log 19:58: intento 1 con 20 celdas repetidas
   e intento 2 con 19). Solución: cadena nivel por nivel con la causa REAL
   sustituida por el servidor. */
check('server: cadena iterativa definida (_analyze_iterative_chain)',
  server.includes('def _analyze_iterative_chain'));
check('server: analyze dispara la iterativa al detectar cadena estancada',
  /\.get\("repetition_cells", 0\) >= 6[\s\S]{0,400}_analyze_iterative_chain\(/.test(server));
check('server: turno user de la cadena pide SOLO el nivel con la causa real sustituida',
  server.includes('_CONTINUATION_PROMPT') && server.includes('Pregunta del nivel {n}: {pregunta}'));
check('server: la iterativa adopta regeneraciones numeradas Y bloques de un solo nivel',
  server.includes('def _parse_single_level') && server.includes('def _extract_categories'));
check('server: anti-copia por nivel (_is_stagnant_vs) con reintento a temp alta',
  server.includes('def _is_stagnant_vs') && server.includes('re-generado tras copia'));
check('server: la cadena corta en N/A cuando un nivel no tiene causas (_pregunta_from_causa)',
  server.includes('def _pregunta_from_causa') && server.includes('la cadena termina'));
check('server: build_pregunta ignora la plantilla copiada literal (causa principal del nivel)',
  /causa principal del nivel", head, re\.IGNORECASE/.test(server));
/* ══════════════ J. FIXES DE LA PRUEBA REAL 21:16 (dedupe + preferencia) ═══
   La iterativa corrió bien pero: (1) el single-shot estancado ganó por score
   (70/20 repetidas vs 68/10) y se devolvió EL ESTANCADO; (2) el modelo rellena
   Maquinaria/Medio Ambiente/Material con el mismo texto genérico por nivel. */
check('server: dedupe pasa a N/A las categorías repetidas del nivel anterior',
  server.includes('Dedupe') && /Dedupe: \{deduped_cells\} celda\(s\) repetidas pasaron a N\/A/.test(server));
check('server: analyze prefiere la cadena con MENOS repetición aunque el score sea menor',
  server.includes('rep_it < rep_ss'));
check('server: el dedupe va DESPUÉS de _enforce_causal_chain (no lo des-copiaría)',
  /_enforce_causal_chain\(parsed\)[\s\S]{0,900}deduped_cells/.test(server));
/* ══════════════ K. ENCABEZADO CONSTANTE POR NIVEL (captura 2026-09-25) ══════
   Criterio del usuario: cada nivel lleva SIEMPRE la pregunta maestra
   "¿Por qué ocurrió el accidente?"; la cadena causal vive en el CONTENIDO de
   cada M (del nivel anterior de la MISMA categoría), no en el título. */
check('server: _uniform_preguntas define el encabezado constante',
  server.includes('def _uniform_preguntas') && server.includes('"¿Por qué ocurrió el accidente?"'));
check('server: encabezado constante se aplica en analyze, iterativa y regenerate',
  (server.match(/_uniform_preguntas\(/g) || []).length >= 5);
/* ══════════════ REPORTE ══════════════ */

var failed = 0;
checks.forEach(function (c) {
  if (c.ok) {
    console.log('  OK  ' + c.name);
  } else {
    failed++;
    console.log('FAIL  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  }
});

console.log('\n============================================================');
console.log('total: ' + checks.length + ' | pass: ' +
  (checks.length - failed) + ' | fail: ' + failed);
console.log('============================================================');

process.exit(failed === 0 ? 0 : 1);

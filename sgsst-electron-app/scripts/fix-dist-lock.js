// Pre-build cleanup for dist/
//
// Why this exists (📦638):
//   electron-builder 32-bit NSIS no puede mmapear archivos >2GB (failed creating mmap).
//   Si dist/ acumula .exe/.blockmap/.tmp de builds anteriores, electron-builder los
//   EMBEBE en el nuevo build (aumentando el .nsis.7z >2GB → build falla).
//   Además, el .tmp anidado de builds fallidos añade ~317 MB de electron.exe duplicado.
//
//   Esta limpieza se ejecuta AUTOMÁTICAMENTE al inicio de cada build (vía scripts/build:win).
//   También se puede ejecutar manualmente: `node scripts/fix-dist-lock.js`
//
// Qué hace:
//   1. Borra todos los dist/**/win-unpacked.tmp (raíz + anidados, de builds fallidos)
//   2. Borra todos los dist/*.exe (instaladores de versiones anteriores)
//   3. Borra todos los dist/*.exe.blockmap (blockmaps viejos)
//   4. Borra los .log y builder-debug.yml (basura del builder)
//
//   NO borra: latest.yml, build.json, u otros archivos actuales del release vigente.

const fs = require('fs/promises');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const currentVersion = require(path.join(__dirname, '..', 'package.json')).version;

function fmtMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function getFolderSize(p) {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    let total = 0;
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) {
        total += await getFolderSize(full);
      } else {
        try {
          total += (await fs.stat(full)).size;
        } catch {}
      }
    }
    return total;
  } catch {
    return 0;
  }
}

async function safeTrash(p) {
  try {
    await fs.rm(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
    return true;
  } catch (e) {
    console.warn(`  WARN: no se pudo borrar ${path.basename(p)}: ${e.code}`);
    return false;
  }
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  if (!(await fileExists(distDir))) {
    console.log('dist/ no existe, nada que limpiar.');
    return;
  }

  console.log('Limpiando dist/ antes del build...');
  console.log('Versión actual:', currentVersion);

  const entries = await fs.readdir(distDir, { withFileTypes: true });
  let totalFreed = 0;
  let totalCleaned = 0;

  // 1. Limpiar dist/**/win-unpacked.tmp (recursivo)
  async function cleanTmps(dir) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory() && item.name === 'win-unpacked.tmp') {
        const size = await getFolderSize(full);
        console.log(`  - borrando ${path.relative(distDir, full)} (${fmtMB(size)})`);
        if (await safeTrash(full)) {
          totalFreed += size;
          totalCleaned++;
        }
      } else if (item.isDirectory()) {
        await cleanTmps(full);
      }
    }
  }
  await cleanTmps(distDir);

  // 2. Limpiar dist/*.exe (excepto el actual)
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.exe') && !e.name.includes(currentVersion)) {
      const full = path.join(distDir, e.name);
      const size = (await fs.stat(full)).size;
      console.log(`  - borrando ${e.name} (${fmtMB(size)})`);
      if (await safeTrash(full)) {
        totalFreed += size;
        totalCleaned++;
      }
    }
  }

  // 3. Limpiar dist/*.exe.blockmap (excepto el actual)
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.exe.blockmap') && !e.name.includes(currentVersion)) {
      const full = path.join(distDir, e.name);
      const size = (await fs.stat(full)).size;
      console.log(`  - borrando ${e.name} (${fmtMB(size)})`);
      if (await safeTrash(full)) {
        totalFreed += size;
        totalCleaned++;
      }
    }
  }

  // 4. Limpiar logs y builder-debug.yml (basura)
  for (const e of entries) {
    if (e.isFile() && (e.name.endsWith('.log') || e.name === 'builder-debug.yml' || e.name === 'build.log')) {
      const full = path.join(distDir, e.name);
      const size = (await fs.stat(full)).size;
      console.log(`  - borrando ${e.name} (${fmtMB(size)})`);
      if (await safeTrash(full)) {
        totalFreed += size;
        totalCleaned++;
      }
    }
  }

  console.log(`\nListo. ${totalCleaned} items borrados, ${fmtMB(totalFreed)} liberados.`);
})();

// Try to release the file lock on dist\win-unpacked.tmp
const fs = require('fs/promises');
const path = require('path');

const target = path.join(__dirname, '..', 'dist', 'win-unpacked.tmp');

(async () => {
  console.log('Target:', target);

  // 1. Try rename
  try {
    const backup = target + '.old-' + Date.now();
    await fs.rename(target, backup);
    console.log('RENAME OK ->', path.basename(backup));
    return;
  } catch (e) {
    console.log('RENAME FAIL:', e.code, e.message);
  }

  // 2. Try rm with retries
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await fs.rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
      console.log('RM OK on attempt', attempt);
      const exists = await fs.stat(target).then(() => true).catch(() => false);
      console.log('EXISTS AFTER RM:', exists);
      return;
    } catch (e) {
      console.log('RM FAIL attempt', attempt, ':', e.code, e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('All attempts failed. The .tmp folder is locked by another process.');
})();

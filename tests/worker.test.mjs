import { build } from 'esbuild';
import { Worker } from 'node:worker_threads';
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { outputFiles } = await build({ entryPoints: [path.join(root, 'src/search/regex.worker.ts')], bundle: true, write: false, format: 'iife', logLevel: 'silent' });
const bootstrap = `const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:data=>parentPort.postMessage(data)};${outputFiles[0].text}\nparentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});`;

function run(query, records, limit = 1000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(bootstrap, { eval: true });
    let deadline;
    worker.on('error', reject);
    worker.on('message', async response => {
      if (response.ready) {
        deadline = setTimeout(async () => { await worker.terminate(); resolve({ timeout: true }); }, limit);
        worker.postMessage({ query, records });
      } else {
        clearTimeout(deadline);
        await worker.terminate();
        resolve(response);
      }
    });
  });
}

test('worker compilado responde sem bloquear a thread principal', async () => {
  const result = await run('^LI_', [{ id: 'ok', fields: ['LI_Temp'] }, { id: 'other', fields: ['SI_Temp'] }]);
  assert.deepEqual(result, { ids: ['ok'], error: null });
});

test('um regex com backtracking excessivo pode ser interrompido', async () => {
  let mainThreadResponsive = false;
  const timer = setTimeout(() => { mainThreadResponsive = true; }, 20);
  const result = await run('^(a+)+$', [{ id: 'slow', fields: ['a'.repeat(40) + '!'] }], 100);
  clearTimeout(timer);
  assert.deepEqual(result, { timeout: true });
  assert.ok(mainThreadResponsive);
});

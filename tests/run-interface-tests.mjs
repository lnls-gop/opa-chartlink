import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(path.join(tmpdir(), 'chartlink-tests-'));
try {
  const output = path.join(dir, 'interface.test.cjs');
  await build({ entryPoints: [path.join(root, 'tests/interface.test.tsx')], outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', logLevel: 'silent' });
  const run = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
} finally { await rm(dir, { recursive: true, force: true }); }

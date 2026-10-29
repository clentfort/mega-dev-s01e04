import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it('exports the served page and fails without writing for a missing night', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-export-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'rig.json'), JSON.stringify({ adapter: 'shim', installed: '', beatEverySeconds: 60, runsDir: dir }));
  const args = [resolve('node_modules/tsx/dist/cli.mjs'), '--tsconfig', resolve('tsconfig.json'), resolve('scripts/export-preview.ts')];
  const env = { ...process.env, LANE_MARKER: 'DUMMY-EXPORT-MARKER' };
  const missing = spawnSync(process.execPath, args, { cwd: dir, env, encoding: 'utf8' });
  expect(missing.status).not.toBe(0);
  expect(missing.stderr).toContain('HTTP 404');
  expect(existsSync(join(dir, '.preview/index.html'))).toBe(false);
  writeFileSync(join(dir, '2026-10-28.jsonl'), JSON.stringify({ at: '2026-10-28T00:00:00Z', job: 'sample', status: 'ok', owner: null }));
  execFileSync(process.execPath, args, { cwd: dir, env });
  const html = readFileSync(join(dir, '.preview/index.html'), 'utf8');
  expect(html).toContain('DUMMY-EXPORT-MARKER');
  expect(html).toContain('sample');
  expect(html).toContain('<style>');
  expect(html).not.toMatch(/<script\b|<link\b/i);
});

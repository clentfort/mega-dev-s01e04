import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-reader-'));
  dirs.push(dir);
  writeFileSync(join(dir, '2026-10-28.jsonl'), contents);
  return dir;
}

describe('readNight', () => {
  it('aggregates the real fixture without dropping a null owner', () => {
    expect(readNight('runs', '2026-10-28')).toEqual({
      badLines: 1, counts: { ok: 10, retry: 4, fail: 1 }, rows: [
        { job: 'digest/render', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00' },
        { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' },
        { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held', firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' },
        { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded', firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00' },
        { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00' },
      ],
    });
  });

  it('orders by instant, breaks ties by line, and retains the latest supplied error', () => {
    const events = [
      { at: '2026-10-28T12:00:00+02:00', job: 'z', status: 'fail', owner: 'first', error: 'new' },
      { at: '2026-10-28T09:30:00Z', job: 'z', status: 'retry', owner: 'older', error: 'old' },
      { at: '2026-10-28T05:00:00-05:00', job: 'z', status: 'ok', owner: null },
      { at: '2026-10-28T10:00:00Z', job: 'A', status: 'ok', owner: null },
    ];
    expect(readNight(fixture(events.map(event => JSON.stringify(event)).join('\n')), '2026-10-28')).toEqual({
      badLines: 0, counts: { ok: 2, retry: 1, fail: 1 }, rows: [
        { job: 'A', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T10:00:00Z', lastAt: '2026-10-28T10:00:00Z' },
        { job: 'z', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: 'new', firstAt: '2026-10-28T09:30:00Z', lastAt: '2026-10-28T05:00:00-05:00' },
      ],
    });
  });

  it('orders sub-millisecond instants without treating them as ties', () => {
    const base = { job: 'a', status: 'ok', owner: null };
    const text = [
      { ...base, at: '2026-10-28T00:00:00.0009Z', error: 'later' },
      { ...base, at: '2026-10-28T00:00:00.0001Z', error: 'earlier' },
    ].map(event => JSON.stringify(event)).join('\n');
    const row = readNight(fixture(text), '2026-10-28')?.rows[0];
    expect(row?.firstAt).toBe('2026-10-28T00:00:00.0001Z');
    expect(row?.lastAt).toBe('2026-10-28T00:00:00.0009Z');
    expect(row?.lastError).toBe('later');
  });

  it('counts invalid schemas and malformed lines, ignoring blank lines', () => {
    const base = { at: '2026-10-28T00:00:00Z', job: 'a', status: 'ok', owner: null };
    const invalid = [null, [], {}, { ...base, at: '2026-02-30T00:00:00Z' },
      { ...base, at: '2026-10-28T00:00:00' }, { ...base, job: '' },
      { ...base, status: 'unknown' }, { ...base, owner: 1 }, { ...base, error: null }];
    const text = [JSON.stringify(base), ...invalid.map(value => JSON.stringify(value)), '{', '  ', ''].join('\n');
    const result = readNight(fixture(text), '2026-10-28');
    expect(result?.badLines).toBe(10);
    expect(result?.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
    expect(result?.rows).toHaveLength(1);
  });

  it('distinguishes empty and missing files and propagates other filesystem errors', () => {
    const dir = fixture(' \n\n');
    expect(readNight(dir, '2026-10-28')).toEqual({ rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    expect(readNight(dir, '2026-10-29')).toBeNull();
    mkdirSync(join(dir, '2026-10-30.jsonl'));
    expect(() => readNight(dir, '2026-10-30')).toThrow();
    expect(() => readNight(dir, '../2026-10-28')).toThrow();
  });
});

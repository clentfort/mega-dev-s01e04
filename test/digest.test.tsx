import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

let runsDir: string;

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function app() {
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
}

function night(content: string) {
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), content);
}

function tableRows(html: string): string[] {
  const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [];
  expect(tables).toHaveLength(1);
  return (tables[0] ?? '').match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
}

describe('digest routes', () => {
  it('returns matching sorted jobs and all aggregated values in HTML and JSON', async () => {
    const events = [
      { at: '2026-10-28T23:00:00-04:00', job: 'zeta', status: 'fail', owner: null, error: 'broken <script>alert(1)</script> & more' },
      { at: '2026-10-29T02:00:00+01:00', job: 'alpha & beta', status: 'retry', owner: 'Ada <ops>' },
      { at: '2026-10-29T02:01:00+01:00', job: 'alpha & beta', status: 'retry', owner: 'Ada <ops>' },
      { at: '2026-10-29T02:02:00+01:00', job: 'alpha & beta', status: 'retry', owner: 'Ada <ops>' },
      { at: '2026-10-29T02:03:00+01:00', job: 'alpha & beta', status: 'ok', owner: 'Ada <ops>' },
    ];
    night(events.map((event) => JSON.stringify(event)).join('\n'));
    const server = app();
    const htmlResponse = await server.request('/digest/2026-10-28');
    const jsonResponse = await server.request('/api/digest/2026-10-28');
    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    const html = await htmlResponse.text();
    const digest: NightDigest = await jsonResponse.json();
    expect(digest).toEqual({
      rows: [
        { job: 'alpha & beta', owner: 'Ada <ops>', runs: 4, retries: 3, lastStatus: 'ok', lastError: null, firstAt: '2026-10-29T02:00:00+01:00', lastAt: '2026-10-29T02:03:00+01:00' },
        { job: 'zeta', owner: null, runs: 1, retries: 0, lastStatus: 'fail', lastError: 'broken <script>alert(1)</script> & more', firstAt: '2026-10-28T23:00:00-04:00', lastAt: '2026-10-28T23:00:00-04:00' },
      ],
      badLines: 0,
      counts: { ok: 1, retry: 3, fail: 1 },
    });
    const rows = tableRows(html).filter((row) => /<td\b/i.test(row));
    expect(rows).toHaveLength(digest.rows.length);
    expect(rows[0]).toContain('alpha &amp; beta');
    expect(rows[0]).toContain('Ada &lt;ops&gt;');
    for (const value of ['4', '3', 'ok', '2026-10-29T02:00:00+01:00', '2026-10-29T02:03:00+01:00', '—']) expect(rows[0]).toContain(value);
    // Both the high retry count and the failure must be visually marked.
    expect(rows[0]).toMatch(/\bclass=|<(?:strong|b|mark)\b/i);
    expect(rows[1]).toMatch(/\bclass=|<(?:strong|b|mark)\b/i);
    expect(rows[1]).toContain(digest.rows[1].job);
    for (const value of ['—', '1', '0', 'fail', '2026-10-28T23:00:00-04:00', 'broken &lt;script&gt;alert(1)&lt;/script&gt; &amp; more']) expect(rows[1]).toContain(value);
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('returns 404 on both routes for a missing night', async () => {
    const server = app();
    expect((await server.request('/digest/2026-10-28')).status).toBe(404);
    expect((await server.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders an empty night and returns an empty digest', async () => {
    night('');
    const server = app();
    const html = await server.request('/digest/2026-10-28');
    const json = await server.request('/api/digest/2026-10-28');
    expect(html.status).toBe(200);
    expect(await html.text()).toMatch(/nothing ran/i);
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual({ rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts a bad line and continues rendering valid jobs', async () => {
    night('{broken\n' + JSON.stringify({ at: '2026-10-28T08:00:00+02:00', job: 'survivor', status: 'ok', owner: null }) + '\n');
    const server = app();
    const htmlResponse = await server.request('/digest/2026-10-28');
    const jsonResponse = await server.request('/api/digest/2026-10-28');
    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    const html = await htmlResponse.text();
    const digest: NightDigest = await jsonResponse.json();
    expect(digest).toEqual({ rows: [{ job: 'survivor', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T08:00:00+02:00', lastAt: '2026-10-28T08:00:00+02:00' }], badLines: 1, counts: { ok: 1, retry: 0, fail: 0 } });
    expect(tableRows(html).some((row) => row.includes('survivor'))).toBe(true);
    expect(html).toMatch(/(?:1[^<]*(?:bad|invalid|malformed)|(?:bad|invalid|malformed)[^<]*1)/i);
  });
});

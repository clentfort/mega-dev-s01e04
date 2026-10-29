import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type Instant = { milliseconds: number; fraction: string };
type Event = { at: string; job: string; status: RunStatus; owner: string | null; error?: string; time: Instant };

function compare(a: Instant, b: Instant): number {
  if (a.milliseconds !== b.milliseconds) return a.milliseconds < b.milliseconds ? -1 : 1;
  const length = Math.max(a.fraction.length, b.fraction.length);
  const left = a.fraction.padEnd(length, '0');
  const right = b.fraction.padEnd(length, '0');
  return left < right ? -1 : left > right ? 1 : 0;
}

function timestamp(value: string): Instant | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 ||
      Number(minute) > 59 || Number(second) > 59 ||
      (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59))) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? { milliseconds: time, fraction: /\.(\d+)/.exec(value)?.[1] ?? '' } : null;
}

function parseEvent(line: string): Event | null {
  let value: unknown;
  try { value = JSON.parse(line); } catch { return null; }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.at !== 'string' || typeof record.job !== 'string' || record.job.trim() === '' ||
      (record.status !== 'ok' && record.status !== 'retry' && record.status !== 'fail') ||
      (typeof record.owner !== 'string' && record.owner !== null) ||
      ('error' in record && typeof record.error !== 'string')) return null;
  const time = timestamp(record.at);
  if (time === null) return null;
  return { at: record.at, job: record.job, status: record.status, owner: record.owner,
    ...(typeof record.error === 'string' ? { error: record.error } : {}), time };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) throw new Error('Invalid night');
  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const counts = { ok: 0, retry: 0, fail: 0 };
  const jobs = new Map<string, { row: DigestRow; first: Instant; last: Instant; errorTime: Instant | null }>();
  let badLines = 0;
  for (const line of contents.split('\n')) {
    if (!line.trim()) continue;
    const event = parseEvent(line);
    if (!event) { badLines++; continue; }
    counts[event.status]++;
    const entry = jobs.get(event.job);
    if (!entry) {
      jobs.set(event.job, { row: { job: event.job, owner: event.owner, runs: 1,
        retries: Number(event.status === 'retry'), lastStatus: event.status,
        lastError: event.error ?? null, firstAt: event.at, lastAt: event.at },
        first: event.time, last: event.time, errorTime: event.error === undefined ? null : event.time });
      continue;
    }
    const { row } = entry;
    row.runs++;
    if (event.status === 'retry') row.retries++;
    if (compare(event.time, entry.first) < 0) { entry.first = event.time; row.firstAt = event.at; }
    if (compare(event.time, entry.last) >= 0) {
      entry.last = event.time; row.lastAt = event.at; row.owner = event.owner; row.lastStatus = event.status;
    }
    if (event.error !== undefined && (entry.errorTime === null || compare(event.time, entry.errorTime) >= 0)) {
      entry.errorTime = event.time; row.lastError = event.error;
    }
  }
  return { rows: [...jobs.values()].map(({ row }) => row).sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0), badLines, counts };
};

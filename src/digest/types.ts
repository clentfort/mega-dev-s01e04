export type RunStatus = 'ok' | 'retry' | 'fail';

/** One row per job, aggregated from valid events in the night. */
export type DigestRow = {
  job: string;
  /** Owner on the latest event, including null when unknown. */
  owner: string | null;
  /** Total valid events for this job, including retries. */
  runs: number;
  /** Number of events with status retry. */
  retries: number;
  lastStatus: RunStatus;
  /** Most recent supplied error for this job, or null if none was supplied. */
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type NightDigest = {
  /** Rows sorted by job in ascending code-unit order. */
  rows: DigestRow[];
  /** Nonblank lines that are not valid run events. */
  badLines: number;
  /** Counts of valid events, not jobs. */
  counts: DigestCounts;
};

/**
 * Synchronous reader implemented by src/digest/read-night.ts. Reads
 * runsDir/<night>.jsonl; null means the file is missing. A present empty file
 * returns empty rows and zero counts. Blank lines are ignored; malformed JSON
 * or events missing a valid at, job, status, or nullable owner are bad lines.
 * An optional error, when present, must be a string. Timestamps must identify
 * an instant with an explicit offset (or Z).
 *
 * Events are ordered by timestamp instant, not by their offset strings. For
 * equal instants, the later line is later. First/last timestamps retain the
 * original strings and offsets. Latest owner and status come from the latest
 * event; lastError comes from the latest event that supplies an error.
 * Other filesystem errors are propagated rather than treated as missing.
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;

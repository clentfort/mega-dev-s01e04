import { serve } from '@hono/node-server';
import { mkdir, writeFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';

const server = serve({ fetch: createApp().fetch, hostname: '127.0.0.1', port: 0 });
try {
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP address');
  const response = await fetch(`http://127.0.0.1:${address.port}/digest/2026-10-28`);
  if (response.status !== 200) throw new Error(`Digest returned HTTP ${response.status}`);
  const html = await response.text();
  await mkdir('.preview', { recursive: true });
  await writeFile('.preview/index.html', html);
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

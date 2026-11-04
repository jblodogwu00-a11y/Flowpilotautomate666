import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prodBundle = path.join(__dirname, 'dist-server/server.mjs');

// Detect if running under tsx (development mode)
const isRunningViaTsx =
  Boolean((process as any)[Symbol.for('tsx.version')]) ||
  process.execArgv.some((a) => a.includes('tsx'));

// In production or plain node runtime with prebuilt bundle, launch bundled server
if (!isRunningViaTsx && fs.existsSync(prodBundle)) {
  await import('./dist-server/server.mjs');
} else {
  // In development with tsx, dynamically import source serverCore
  await import('./serverCore.js');
}

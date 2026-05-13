import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { promisify } from 'node:util';
import fetch from 'node-fetch';

const sleep = promisify(setTimeout);

test('Adapter starts and responds to health check', async () => {
  // Start adapter in background
  const adapterProcess = execSync('node adapter-server.mjs', {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  });

  // Wait a bit for server to start
  await sleep(1000);

  try {
    const response = await fetch('http://127.0.0.1:4000/health');
    assert.strictEqual(response.status, 200);

    const data = await response.json();
    assert.strictEqual(data.status, 'ok');
    assert.ok(data.uptime >= 0);
    assert.strictEqual(data.version, '7-unified');
  } finally {
    // Clean up process
    try {
      execSync('pkill -f adapter-server.mjs', { stdio: 'ignore' });
    } catch (err) {
      // Ignore if process already died
    }
  }
});

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import fetch from 'node-fetch';

const BASE_URL = 'http://127.0.0.1:4000';

test('Health endpoint returns ok', async () => {
  const response = await fetch(`${BASE_URL}/health`);
  assert.strictEqual(response.status, 200);

  const data = await response.json();
  assert.strictEqual(data.status, 'ok');
  assert.ok(data.uptime >= 0);
  assert.strictEqual(data.version, '7-unified');
});

test('Ready endpoint returns status', async () => {
  const response = await fetch(`${BASE_URL}/ready`);
  assert.ok(response.status === 200 || response.status === 503);

  const data = await response.json();
  assert.ok(data.status === 'ready' || data.status === 'not_ready');
});

test('Models endpoint returns model list', async () => {
  const response = await fetch(`${BASE_URL}/v1/models`);
  assert.strictEqual(response.status, 200);

  const data = await response.json();
  assert.strictEqual(data.object, 'list');
  assert.ok(Array.isArray(data.data));
  assert.ok(data.data.length > 0);
});

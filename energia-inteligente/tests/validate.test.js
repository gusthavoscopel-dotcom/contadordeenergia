import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReadingsPayload } from '../api/_lib/validate.js';
import { keyMatches, sha256Hex } from '../api/_lib/deviceAuth.js';

const now = new Date('2026-09-26T14:00:00Z');

test('aceita lote de leituras', () => {
  const p = parseReadingsPayload({
    deviceId: 'ESP32-001',
    timestamp: '2026-09-26T13:59:58Z',
    readings: [
      { sensor: 1, power: 350.5, voltage: 127, current: 2.76 },
      { sensor: 2, power: 0 },
    ],
  }, now);
  assert.equal(p.items.length, 2);
  assert.equal(p.items[1].voltage, null);
  assert.equal(p.timestamp.toISOString(), '2026-09-26T13:59:58.000Z');
  assert.equal(p.clockAdjusted, false);
});

test('aceita leitura única', () => {
  const p = parseReadingsPayload({ deviceId: 'ESP32-001', sensor: 3, power: '80.2' }, now);
  assert.deepEqual(p.items, [{ sensor: 3, power: 80.2, voltage: null, current: null }]);
});

test('horário sem fuso ou muito distante usa o do servidor', () => {
  const a = parseReadingsPayload({ deviceId: 'ESP32-001', sensor: 1, power: 1, timestamp: '2026-09-26T11:00:00' }, now);
  assert.equal(a.timestamp, now);
  assert.equal(a.clockAdjusted, true);
  const b = parseReadingsPayload({ deviceId: 'ESP32-001', sensor: 1, power: 1, timestamp: '1970-01-01T00:00:00Z' }, now);
  assert.equal(b.timestamp, now);
});

test('rejeita dados inválidos', () => {
  const bad = [
    null,
    { deviceId: 'x', sensor: 1, power: 1 },
    { deviceId: 'ESP32-001', sensor: 1, power: -5 },
    { deviceId: 'ESP32-001', sensor: 0, power: 5 },
    { deviceId: 'ESP32-001', sensor: 1.5, power: 5 },
    { deviceId: 'ESP32-001', sensor: 1, power: 'abc' },
    { deviceId: 'ESP32-001', sensor: 1, power: 1e9 },
    { deviceId: 'ESP32-001', readings: [] },
    { deviceId: 'ESP32-001', readings: [{ sensor: 1, power: 1 }, { sensor: 1, power: 2 }] },
    { deviceId: "ESP32'; drop table", sensor: 1, power: 1 },
  ];
  for (const b of bad) assert.throws(() => parseReadingsPayload(b, now), undefined, JSON.stringify(b));
});

test('comparação de chave do dispositivo', () => {
  const hash = sha256Hex('segredo-123');
  assert.equal(keyMatches('segredo-123', hash), true);
  assert.equal(keyMatches('segredo-124', hash), false);
  assert.equal(keyMatches('', hash), false);
});

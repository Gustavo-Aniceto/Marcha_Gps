import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anttLatestCsv, decodeText } from '../src/radares.ts';

test('radares: acha o CSV mais novo da ANTT', () => {
  const pkg = { result: { resources: [
    { format: 'CSV', url: 'https://dados.antt.gov.br/a/radares9_2026.csv', last_modified: '2026-10-03T10:00:00' },
    { format: 'JSON', url: 'https://dados.antt.gov.br/a/radares10_2026.json', last_modified: '2026-11-03T10:00:00' },
    { format: 'CSV', url: 'https://dados.antt.gov.br/a/radares10_2026.csv', last_modified: '2026-11-03T10:00:00' },
    { format: 'CSV', url: 'https://outro.site/x.csv', last_modified: '2027-01-01' },
  ] } };
  assert.equal(anttLatestCsv(pkg), 'https://dados.antt.gov.br/a/radares10_2026.csv');
  assert.equal(anttLatestCsv({}), null);
  assert.equal(anttLatestCsv(null), null);
});

test('radares: lê UTF-8 com BOM e Latin-1', () => {
  const utf = new TextEncoder().encode('﻿São Paulo').buffer;
  assert.equal(decodeText(utf), 'São Paulo');
  const latin = new Uint8Array([0x53, 0xe3, 0x6f]).buffer; // "São" em Latin-1
  assert.equal(decodeText(latin), 'São');
});

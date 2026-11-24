import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraFor } from '../mapCamera.ts';

test('2D deixa o mapa reto', () => {
  assert.equal(cameraFor({ theme: 'noite', threeD: false, pitch: 70, radiusM: 110 }).pitch, 0);
});
test('ângulo fica entre 20 e 88', () => {
  assert.equal(cameraFor({ theme: 'noite', threeD: true, pitch: 5, radiusM: 110 }).pitch, 20);
  assert.equal(cameraFor({ theme: 'noite', threeD: true, pitch: 99, radiusM: 110 }).pitch, 88);
});
test('raio maior afasta a câmera', () => {
  const perto = cameraFor({ theme: 'noite', threeD: true, pitch: 60, radiusM: 40 }).zoom;
  const longe = cameraFor({ theme: 'noite', threeD: true, pitch: 60, radiusM: 220 }).zoom;
  assert.equal(perto, 18.5);
  assert.ok(longe < perto && longe > 15);
});

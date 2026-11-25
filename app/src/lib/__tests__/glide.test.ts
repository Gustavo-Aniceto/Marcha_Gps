import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayPoint, Glide, lerpAngle, turn } from '../glide.ts';
import { distM, type Route } from '../nav.ts';

const base = { lat: -23.55, lon: -46.63 };
const north = (m: number, heading: number | null = 0) => ({ lat: base.lat + m / 111_195, lon: base.lon, heading });

test('ângulo: vira pelo lado mais curto (350° → 10° passa pelo 0)', () => {
  assert.equal(turn(350, 10), 20);
  assert.equal(turn(10, 350), -20);
  assert.equal(lerpAngle(350, 10, 0.5), 0);
  assert.equal(lerpAngle(null, 90, 0.5), 90);
});

test('primeira leitura: aparece direto no lugar', () => {
  const g = new Glide();
  g.push(north(0), 0);
  assert.deepEqual(g.at(0), north(0));
});

test('desliza entre as leituras no tempo entre elas (sem pulo)', () => {
  const g = new Glide();
  g.push(north(0), 0);
  g.push(north(10), 1000);
  g.push(north(20), 2000);          // leituras a cada 1 s → desliza em 1 s
  const meio = g.at(2500)!;
  assert.ok(Math.abs(distM(meio, north(15)) ) < 0.2, 'na metade do caminho');
  assert.ok(distM(g.at(3000)!, north(20)) < 0.01, 'chega na leitura');
  assert.ok(distM(g.at(5000)!, north(20)) < 0.01, 'e espera lá se a próxima demorar');
});

test('leitura nova no meio do deslize: continua de onde o carro está (não volta)', () => {
  const g = new Glide();
  g.push(north(0), 0);
  g.push(north(10), 1000);
  g.push(north(20), 2000);
  const antes = g.at(2500)!;        // ~15 m
  g.push(north(30), 2500);
  assert.ok(distM(g.at(2500)!, antes) < 0.01, 'sem salto na hora da leitura');
});

test('GPS tremendo parado não mexe o carro', () => {
  const g = new Glide();
  g.push(north(0, 90), 0);
  const v = g.version;
  g.push({ ...north(1), heading: 91 }, 1000);
  assert.equal(g.version, v);
  assert.deepEqual(g.at(1500), north(0, 90));
});

test('salto grande (GPS voltou depois de túnel) vai direto', () => {
  const g = new Glide();
  g.push(north(0), 0);
  g.push(north(800), 1000);
  assert.ok(distM(g.at(1000)!, north(800)) < 0.01);
});

test('direção gira suave e pelo lado curto', () => {
  const g = new Glide();
  g.push(north(0, 350), 0);
  g.push(north(10, 10), 1000);
  assert.equal(Math.round(g.at(1500)!.heading!), 0);
});

test('sem direção na leitura nova: mantém a anterior', () => {
  const g = new Glide();
  g.push(north(0, 45), 0);
  g.push(north(10, null), 1000);
  assert.equal(g.at(2000)!.heading, 45);
});

// rota reta pro leste
const east = (m: number) => ({ lat: base.lat, lon: base.lon + m / (111_195 * Math.cos(base.lat * Math.PI / 180)) });
const route: Route = { coords: [east(0), east(500)], cum: [0, 500], total_m: 500, time_s: 60, maneuvers: [] };

test('navegando perto da rota: carro anda em cima da linha e virado pra ela', () => {
  const gps = { ...east(100), lat: base.lat + 8 / 111_195, heading: 80, accuracy: 10 }; // 8 m ao norte da rota
  const d = displayPoint(gps, route);
  assert.ok(distM(d, east(100)) < 0.5);
  assert.equal(d.heading, 90);
});

test('longe da rota (saiu): fica no ponto do GPS', () => {
  const gps = { ...east(100), lat: base.lat + 60 / 111_195, heading: 0, accuracy: 10 };
  const d = displayPoint(gps, route);
  assert.equal(d.lat, gps.lat);
  assert.equal(d.heading, 0);
});

test('na contramão da rota: encaixa na linha mas mantém a direção real', () => {
  const d = displayPoint({ ...east(100), heading: 270, accuracy: 5 }, route);
  assert.equal(d.heading, 270);
});

test('sem rota: ponto do GPS', () => {
  const p = { ...north(5), accuracy: 5 };
  assert.deepEqual(displayPoint(p, null), north(5));
});

test('carro de outra pessoa (posição a cada ~10 s): desliza o intervalo todo, sem parar no meio', () => {
  const g = new Glide({ maxMs: 12_000, teleportM: 800 });
  g.push(north(0), 0);
  g.push(north(140), 10_000);
  g.push(north(280), 20_000);
  assert.ok(Math.abs(distM(g.at(25_000)!, north(210))) < 0.5);
  g.push(north(900), 30_000); // 620 m em 10 s ainda desliza (não teletransporta)
  assert.ok(distM(g.at(30_000)!, north(280)) < 0.5);
});

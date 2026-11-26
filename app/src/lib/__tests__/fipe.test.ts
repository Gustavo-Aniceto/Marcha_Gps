import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brandLabel, closestYear, familyName, fipeToCar, groupFamilies, matchBrand, matchFamily, norm, parseYearName, versionLabel, yearLabel,
} from '../fipe.ts';

const BRANDS = [
  { codigo: '21', nome: 'Fiat' }, { codigo: '22', nome: 'Ford' }, { codigo: '23', nome: 'GM - Chevrolet' },
  { codigo: '59', nome: 'VW - VolksWagen' }, { codigo: '47', nome: 'Mercedes-Benz' }, { codigo: '13', nome: 'Citroën' },
];

test('fipe: acha a marca pelo apelido', () => {
  assert.equal(norm('Citroën C4'), 'CITROEN C4');
  assert.equal(matchBrand('Chevrolet', BRANDS)?.codigo, '23');
  assert.equal(matchBrand('GM', BRANDS)?.codigo, '23');
  assert.equal(matchBrand('vw', BRANDS)?.codigo, '59');
  assert.equal(matchBrand('Volkswagen', BRANDS)?.codigo, '59');
  assert.equal(matchBrand('Mercedes', BRANDS)?.codigo, '47');
  assert.equal(matchBrand('citroen', BRANDS)?.codigo, '13');
  assert.equal(matchBrand('fiat', BRANDS)?.codigo, '21');
  assert.equal(matchBrand('Lada', BRANDS), null);
  assert.equal(matchBrand('', BRANDS), null);
});

test('fipe: junta versões por modelo', () => {
  const fam = groupFamilies([
    { codigo: '1', nome: 'Astra GLS 2.0 MPFI' }, { codigo: '2', nome: 'Astra GLS 2.0 MPFI SW' },
    { codigo: '3', nome: 'Gol (novo) 1.0 Mi Total Flex 8V 4p' }, { codigo: '4', nome: 'Gol GTI 2.0' }, { codigo: '5', nome: 'A-10 2.5' },
  ]);
  assert.deepEqual(fam.map((f) => [f.name, f.versions.length]), [['A-10', 1], ['ASTRA', 2], ['GOL', 2]]);
  assert.equal(familyName('Palio Weekend 1.6'), 'Palio');
  assert.equal(matchFamily('Astra hatch', fam)?.name, 'ASTRA');
  assert.equal(matchFamily('gol g2', fam)?.name, 'GOL');
  assert.equal(matchFamily('Opala', fam), null);
  assert.equal(versionLabel('Astra GLS 2.0 MPFI', 'ASTRA'), 'GLS 2.0 MPFI');
  assert.equal(versionLabel('Astra', 'ASTRA'), 'Astra');
});

test('fipe: anos e ficha', () => {
  assert.deepEqual(parseYearName('1995 Gasolina'), { year: 1995, fuel: 'Gasolina' });
  assert.deepEqual(parseYearName('32000 Diesel'), { year: null, fuel: 'Diesel' });
  assert.equal(yearLabel('32000 Flex'), 'Zero km · Flex');
  const years = [{ codigo: '1996-1', nome: '1996 Gasolina' }, { codigo: '1995-1', nome: '1995 Gasolina' }];
  assert.equal(closestYear(years, 1995)?.codigo, '1995-1');
  assert.equal(closestYear(years, null)?.codigo, '1996-1');
  assert.equal(closestYear([], 1995), null);
  assert.equal(brandLabel('GM - Chevrolet'), 'Chevrolet');
  assert.equal(brandLabel('VW - VolksWagen'), 'Volkswagen');
  const car = fipeToCar({ valor: 'R$ 12.479,00', marca: 'GM - Chevrolet', modelo: 'Astra GLS 2.0 MPFI', ano: 1995,
                          combustivel: 'Gasolina', codigo_fipe: '004072-0', referencia: 'novembro de 2026' }, 'ASTRA');
  assert.equal(car.make, 'Chevrolet');
  assert.equal(car.model, 'Astra');
  assert.equal(car.fipe_version, 'GLS 2.0 MPFI');
  assert.equal(car.year, 1995);
  assert.equal(fipeToCar({ valor: 'x', marca: 'Fiat', modelo: 'Uno', ano: 32000, combustivel: 'Flex', codigo_fipe: '1', referencia: '' }, 'UNO').year, null);
});

test('plano B: URL direta e leitura da resposta crua', async () => {
  const { fipeDirectUrl, parseFipeRaw } = await import('../fipe.ts');
  assert.equal(fipeDirectUrl('modelos', '59'), 'https://parallelum.com.br/fipe/api/v1/carros/marcas/59/modelos');
  assert.equal(fipeDirectUrl('valor', '59', '5940', '2012-1'), 'https://parallelum.com.br/fipe/api/v1/carros/marcas/59/modelos/5940/anos/2012-1');
  assert.equal(fipeDirectUrl('anos', '59', 'x'), null);
  assert.equal(fipeDirectUrl('valor', '59', '1', '../x'), null);
  assert.deepEqual(parseFipeRaw('modelos', { modelos: [{ codigo: 1, nome: 'Gol ' }], anos: [] }), [{ codigo: '1', nome: 'Gol' }]);
  const v = parseFipeRaw('valor', { Valor: 'R$ 1,00', Marca: 'VW', Modelo: 'Gol', AnoModelo: 2012, Combustivel: 'Gasolina', CodigoFipe: '005340-6', MesReferencia: 'novembro de 2026 ' });
  assert.deepEqual(v, { valor: 'R$ 1,00', marca: 'VW', modelo: 'Gol', ano: 2012, combustivel: 'Gasolina', codigo_fipe: '005340-6', referencia: 'novembro de 2026' });
  assert.equal(parseFipeRaw('valor', { erro: 'x' }), null);
});

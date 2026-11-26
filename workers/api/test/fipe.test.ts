import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIPE_BASE, fipeTarget, parseFipe } from '../src/fipe.ts';

const q = (o: Record<string, string>) => new URLSearchParams(o);

test('fipe: monta só pedidos válidos', () => {
  assert.equal(fipeTarget('/fipe/marcas', q({}))?.url, `${FIPE_BASE}/marcas`);
  assert.equal(fipeTarget('/fipe/modelos', q({ marca: '23' }))?.url, `${FIPE_BASE}/marcas/23/modelos`);
  assert.equal(fipeTarget('/fipe/anos', q({ marca: '23', modelo: '5940' }))?.url, `${FIPE_BASE}/marcas/23/modelos/5940/anos`);
  assert.equal(fipeTarget('/fipe/valor', q({ marca: '23', modelo: '5940', ano: '1995-1' }))?.ttl, 86400);
  assert.equal(fipeTarget('/fipe/modelos', q({ marca: '../x' })), null);
  assert.equal(fipeTarget('/fipe/valor', q({ marca: '23', modelo: '1', ano: '1995' })), null);
  assert.equal(fipeTarget('/fipe/outra', q({})), null);
});

test('fipe: lê as respostas', () => {
  assert.deepEqual(parseFipe('/fipe/marcas', [{ codigo: '23', nome: 'GM - Chevrolet ' }, { x: 1 }]), [{ codigo: '23', nome: 'GM - Chevrolet' }]);
  assert.deepEqual(parseFipe('/fipe/modelos', { modelos: [{ codigo: 5940, nome: 'Astra GLS 2.0 MPFI' }], anos: [] }),
    [{ codigo: '5940', nome: 'Astra GLS 2.0 MPFI' }]);
  assert.deepEqual(parseFipe('/fipe/valor', {
    TipoVeiculo: 1, Valor: 'R$ 12.479,00', Marca: 'GM - Chevrolet', Modelo: 'Astra GLS 2.0 MPFI', AnoModelo: 1995,
    Combustivel: 'Gasolina', CodigoFipe: '004072-0', MesReferencia: 'novembro de 2026 ', SiglaCombustivel: 'G',
  }), { valor: 'R$ 12.479,00', marca: 'GM - Chevrolet', modelo: 'Astra GLS 2.0 MPFI', ano: 1995, combustivel: 'Gasolina',
        codigo_fipe: '004072-0', referencia: 'novembro de 2026' });
  assert.equal(parseFipe('/fipe/valor', { erro: 'x' }), null);
});

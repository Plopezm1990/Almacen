import test from 'node:test';
import assert from 'node:assert/strict';
import {projectFiscalCents} from './fiscal-cents.mjs';

test('proyecta a céntimos con ajuste explícito y deja intactos los importes fuente',()=>{
  const raw=[{id:'line-1',base:'6.66667000',discount:'3.33333000',
    tax:'0.66666700',total:'7.33333700'}];
  assert.deepEqual(projectFiscalCents(raw),{
    lines:[{id:'line-1',subtotal:'10.00',discount:'3.33',base:'6.67',tax:'0.67',
      roundingAdjustment:'-0.01',total:'7.33'}],
    document:{subtotal:'10.00',discount:'3.33',base:'6.67',tax:'0.67',
      roundingAdjustment:'-0.01',total:'7.33'},
  });
  assert.equal(raw[0].total,'7.33333700');
});

test('asigna restos entre líneas por fracción mayor e id estable',()=>{
  const projected=projectFiscalCents([
    {id:'b',base:'0.00333333',discount:'0',tax:'0.00166667',total:'0.00500000'},
    {id:'a',base:'0.00333333',discount:'0',tax:'0.00166667',total:'0.00500000'},
  ]);
  assert.deepEqual(projected.lines,[
    {id:'b',subtotal:'0.00',discount:'0.00',base:'0.00',tax:'0.00',roundingAdjustment:'0.00',total:'0.00'},
    {id:'a',subtotal:'0.01',discount:'0.00',base:'0.01',tax:'0.00',roundingAdjustment:'0.00',total:'0.01'},
  ]);
  assert.equal(projected.document.total,'0.01');
});

test('no asigna descuento mostrado por encima del subtotal de una línea',()=>{
  const projected=projectFiscalCents([
    {id:'a',base:'0.00010000',discount:'0.00490000',tax:'0',total:'0.00010000'},
    {id:'b',base:'0.00490000',discount:'0.00020000',tax:'0',total:'0.00490000'},
  ]);
  assert.equal(projected.document.subtotal,'0.01');
  assert.equal(projected.document.discount,'0.01');
  assert.equal(projected.document.base,'0.00');
  assert.equal(projected.document.roundingAdjustment,'0.01');
  assert.equal(projected.document.total,'0.01');
  assert(projected.lines.every((line)=>Number(line.base)>=0));
});

test('redondea el IVA dentro de cada tipo fiscal antes de conciliar el documento',()=>{
  const projected=projectFiscalCents([
    {id:'a',base:'0.05000000',discount:'0',tax:'0.00500000',total:'0.05500000',taxBucket:'10'},
    {id:'b',base:'0.02500000',discount:'0',tax:'0.00500000',total:'0.03000000',taxBucket:'20'},
  ]);
  assert.equal(projected.document.tax,'0.02');
  assert.equal(projected.document.subtotal,'0.08');
  assert.equal(projected.document.total,'0.09');
  assert.equal(projected.document.roundingAdjustment,'-0.01');
});

test('rechaza líneas internas incoherentes, ids duplicados y precisión superior a 8',()=>{
  assert.throws(()=>projectFiscalCents([{id:'a',base:'1',discount:'0',tax:'0',total:'2'}]),/no concilia/);
  assert.throws(()=>projectFiscalCents([
    {id:'a',base:'1',discount:'0',tax:'0',total:'1'},
    {id:'a',base:'1',discount:'0',tax:'0',total:'1'},
  ]),/duplicado/);
  assert.throws(()=>projectFiscalCents([{id:'a',base:'1.000000001',discount:'0',tax:'0',total:'1'}]),/decimales/);
});

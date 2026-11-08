// N-02 — contrato de procedencia para la reconciliación de funciones.
//
// No prueba contra una base remota ni modifica datos. Comprueba que la
// migración de reconciliación contiene exactamente los bloques extraídos de
// las migraciones canónicas de release y que no reintroduce la guarda manual
// que solo se observó en QA.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const MIGRACION_N02 = join(REPO, 'supabase/migrations/20261108193000_n02_reconcile_deployed_db_functions.sql');

const leer = (ruta) => readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');
const extraer = (texto, inicio, fin) => {
  const posicion = texto.toLowerCase().indexOf(inicio.toLowerCase());
  assert.notEqual(posicion, -1, `no se encontró el bloque ${inicio}`);
  const final = texto.indexOf(fin, posicion);
  assert.notEqual(final, -1, `no se encontró el final del bloque ${inicio}`);
  return texto.slice(posicion, final + fin.length);
};

const reconciliacion = leer(MIGRACION_N02);
const canonicos = [
  {
    nombre: 'private.la_usuario_activo()',
    ruta: 'supabase/migrations/20261108100000_a01_baja_empleado_revoca_acceso.sql',
    inicio: 'create or replace function private.la_usuario_activo',
    fin: '$function$;'
  },
  {
    nombre: 'public.obtener_contexto_operativo(text)',
    ruta: 'supabase/migrations/20260919225831_pm33_p05_identidad_antes_de_actividad.sql',
    inicio: 'create or replace function public.obtener_contexto_operativo',
    fin: '$function$;'
  },
  {
    nombre: 'public.bootstrap_owner_instalacion(text,text)',
    ruta: 'supabase/migrations/20260914223200_owner_installation_bootstrap.sql',
    inicio: 'create or replace function public.bootstrap_owner_instalacion',
    fin: '$$;'
  }
];

for (const canonico of canonicos) {
  const fuente = leer(join(REPO, canonico.ruta));
  const bloqueFuente = extraer(fuente, canonico.inicio, canonico.fin);
  const bloqueReconciliacion = extraer(reconciliacion, canonico.inicio, canonico.fin);
  assert.equal(bloqueReconciliacion, bloqueFuente, `${canonico.nombre}: el bloque no coincide con la fuente versionada`);
  console.log(`ok - ${canonico.nombre}: bloque canónico preservado`);
}

assert.match(reconciliacion, /revoke all on function private\.la_usuario_activo\(\)/i);
assert.match(reconciliacion, /grant execute on function public\.obtener_contexto_operativo\(text\)/i);
assert.match(reconciliacion, /grant execute on function public\.bootstrap_owner_instalacion\(text, text\)/i);
assert.doesNotMatch(reconciliacion, /contexto_empleado_vinculado_no_operativo/);
assert.match(reconciliacion, /n02_preflight_faltan_objetos/);
console.log('ok - N-02: ACL, preflight y exclusión de la guarda manual preservados');
console.log('N02_CONTRACT_PASS=4 N02_CONTRACT_FAIL=0');

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Contrato estático de D13 (devoluciones: nada sale sin aprobación): la migración 20261003100000.
//  - los md5 de las cinco funciones que se conocen (preflight) son EXACTAMENTE los de sus versiones anteriores en el repositorio;
//  - las funciones reemplazadas solo cambian en las líneas previstas (lista cerrada de líneas quitadas y añadidas);
//  - la función nueva (`abc_aprobar_reembolso`): firma, permiso, separación de funciones, estados, eventos, envío y ACL;
//  - solo se tocan las tablas y funciones previstas; `abc_cancelar_reembolso` y `abc_resolver_reembolso` no se reemplazan.
// CFG_D13_MIGRACION permite probar variantes rotas en las comprobaciones de mutantes. La conducta la prueba tests/cfg/d13-contract.sql.
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const lf = (t) => t.replace(/\r/g, "");
const NOMBRE = "supabase/migrations/20261003100000_abc_config_d13_reembolsos_aprobacion.sql";
const mig = lf(process.env.CFG_D13_MIGRACION ? await readFile(process.env.CFG_D13_MIGRACION, "utf8") : await read(NOMBRE));
const una = (t, s, msg) => assert.equal(t.split(s).length - 1, 1, msg || `una única aparición de «${s.slice(0, 80)}»`);
const md5 = (s) => createHash("md5").update(s).digest("hex");

function bloque(t, ini, fin, nombre) {
  una(t, ini, `${nombre}: una única definición`);
  const i = t.indexOf(ini);
  const j = t.indexOf(fin, i);
  assert.ok(j > i, `${nombre}: no se encuentra el final`);
  return t.slice(i, j + fin.length);
}
const cuerpo = (b) => b.slice(b.indexOf("as $$") + 5, b.lastIndexOf("$$"));
function diferencias(a, b) {
  const la = a.split("\n").map((x) => x.trim()).filter(Boolean);
  const lb = b.split("\n").map((x) => x.trim()).filter(Boolean);
  const cnt = (arr) => arr.reduce((m, x) => (m.set(x, (m.get(x) || 0) + 1), m), new Map());
  const ca = cnt(la), cb = cnt(lb);
  const quitadas = [], anadidas = [];
  for (const [k, v] of ca) for (let i = 0; i < v - (cb.get(k) || 0); i++) quitadas.push(k);
  for (const [k, v] of cb) for (let i = 0; i < v - (ca.get(k) || 0); i++) anadidas.push(k);
  return { quitadas: quitadas.sort(), anadidas: anadidas.sort() };
}

// 1. Nombre y orden de la migración.
assert.match(NOMBRE, /20261003100000_abc_config_d13_reembolsos_aprobacion\.sql$/);
assert.ok("20261003100000" > "20261002250000", "va después de la última migración de la capa de configuración");
assert.match(mig, /set local lock_timeout = '10s';/);
assert.ok(mig.startsWith("-- ABC · D13 devoluciones: nada sale sin aprobación (solo QA"), "cabecera con el alcance «solo QA»");

// 2. Preflight: los md5 son los de las versiones anteriores que están en el repositorio.
const orig = {
  sol: bloque(lf(await read("supabase/migrations/20260924003000_abc_f2_m04c_outbox_persistente.sql")), "create or replace function public.abc_solicitar_reembolso(", "\nend $$;", "solicitar original"),
  can: bloque(lf(await read("supabase/migrations/20260924003000_abc_f2_m04c_outbox_persistente.sql")), "create or replace function public.abc_cancelar_reembolso(", "\nend $$;", "cancelar original"),
  con: bloque(lf(await read("supabase/migrations/20260923235900_abc_f2_m03c_reembolsos_transaccionales.sql")), "create function public.abc_confirmar_reembolso_efectivo(", "\nend $$;", "confirmar efectivo original"),
  cat: bloque(lf(await read("supabase/migrations/20261002240000_abc_config_pieza5_permisos.sql")), "create function private.abc_cap_catalogo()", "\n$$;", "catálogo original"),
  tec: bloque(lf(await read("supabase/migrations/20261002240000_abc_config_pieza5_permisos.sql")), "create function private.abc_cap_techo_permite(", "\n$$;", "techo original")
};
const huellas = {
  "public.abc_solicitar_reembolso(text,text,text,uuid,uuid,numeric,text,uuid,date)": md5(cuerpo(orig.sol)),
  "public.abc_confirmar_reembolso_efectivo(text,text,text,uuid,uuid,uuid,uuid,date)": md5(cuerpo(orig.con)),
  "public.abc_cancelar_reembolso(text,text,text,uuid,text,uuid,date)": md5(cuerpo(orig.can)),
  "private.abc_cap_catalogo()": md5(cuerpo(orig.cat)),
  "private.abc_cap_techo_permite(text,text)": md5(cuerpo(orig.tec))
};
for (const [firma, h] of Object.entries(huellas)) {
  const re = new RegExp(`p\\.oid='${firma.replace(/[().]/g, "\\$&")}'::regprocedure;\\n  if v_h is distinct from '([0-9a-f]{32})'`);
  const m = mig.match(re);
  assert.ok(m, "el preflight comprueba el md5 de " + firma);
  assert.equal(m[1], h, "el md5 del preflight de " + firma + " es el de la versión anterior del repositorio");
}
assert.equal((mig.match(/funcion_distinta/g) || []).length, 5, "cinco comprobaciones de función conocida");
assert.match(mig, /replace\(p\.prosrc,chr\(13\),''\)/, "se ignora el retorno de carro de Windows");
for (const dep of ["abc_cap_catalogo (pieza 5)", "abc_cap_techo_permite (pieza 5)", "abc_encolar_efecto (M04C)", "abc_operacion_iniciar", "abc_operacion_completar", "abc_tiene_capacidad"])
  assert.ok(mig.includes(`'${dep}'`), "el preflight exige " + dep);
assert.match(mig, /objetos de D13 ya existen/, "no se aplica dos veces");

// 3. Las funciones reemplazadas solo cambian en lo previsto.
const nueva = {
  sol: bloque(mig, "create or replace function public.abc_solicitar_reembolso(", "\nend $$;", "solicitar D13"),
  con: bloque(mig, "create or replace function public.abc_confirmar_reembolso_efectivo(", "\nend $$;", "confirmar efectivo D13"),
  cat: bloque(mig, "create or replace function private.abc_cap_catalogo()", "\n$$;", "catálogo D13"),
  tec: bloque(mig, "create or replace function private.abc_cap_techo_permite(", "\n$$;", "techo D13")
};
assert.deepEqual(diferencias(orig.sol, nueva.sol), {
  quitadas: [
    "'currency_code',v_pago.payment_currency_code",
    "'motivo',v_motivo",
    "if v_pago.medio<>'EFECTIVO' then",
    "payment_currency_code,importe_solicitado,motivo,created_by",
    "v_pago.payment_currency_code,v_importe,v_motivo,auth.uid()"
  ].sort(),
  anadidas: [
    "'REEMBOLSO_APROBADO',",
    "'automatica',true",
    "'aprobado',v_auto",
    "'currency_code',v_pago.payment_currency_code,",
    "'importe',v_importe,",
    "'motivo',v_motivo,",
    "'pago_id',p_pago_id,",
    "'requiere_aprobacion',not v_auto",
    "'requiere_aprobacion',not v_auto,",
    ") values (",
    "),",
    ");",
    "-- D13: nada sale hacia el proveedor hasta que el reembolso esté aprobado.",
    "-- D13: quien ya puede confirmar devoluciones (Propietario y Encargado) aprueba su propia solicitud en el acto; quien solo",
    "-- puede solicitarlas (Cajero/a, si el Propietario se lo da) deja la solicitud pendiente de que OTRA persona la apruebe.",
    "aprobado_por,aprobado_at",
    "auth.uid(),p_terminal_id,now(),p_operating_day",
    "case when v_auto then auth.uid() end,case when v_auto then now() end",
    "empresa_id,local_id,operation_id,aggregate_type,aggregate_id,event_type,",
    "end if;",
    "if v_auto and v_pago.medio<>'EFECTIVO' then",
    "if v_auto then",
    "insert into public.abc_eventos(",
    "jsonb_build_object(",
    "p_empresa_id,p_local_id,p_operation_id,'REEMBOLSO',p_reembolso_id::text,",
    "payload,actor_user_id,terminal_id,occurred_at,operating_day",
    "payment_currency_code,importe_solicitado,motivo,created_by,",
    "v_auto boolean;",
    "v_auto:=private.abc_tiene_capacidad(p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR');",
    "v_pago.payment_currency_code,v_importe,v_motivo,auth.uid(),"
  ].sort()
}, "solicitar: solo cambian las líneas previstas");
assert.deepEqual(diferencias(orig.con, nueva.con), {
  quitadas: ["create function public.abc_confirmar_reembolso_efectivo("],
  anadidas: ["-- D13: el dinero no sale de la caja hasta que el reembolso esté aprobado.", "create or replace function public.abc_confirmar_reembolso_efectivo(", "end if;", "if v_reembolso.aprobado_at is null then", "raise exception 'reembolso_pendiente_aprobacion';"].sort()
}, "confirmar efectivo: solo cambian las líneas previstas");
assert.deepEqual(diferencias(orig.cat, nueva.cat), {
  quitadas: ["('ABC_REEMBOLSO_SOLICITAR','GENERAL',true,true,false,false,'ENCARGADO'),", "create function private.abc_cap_catalogo()"].sort(),
  anadidas: ["('ABC_REEMBOLSO_SOLICITAR','GENERAL',true,true,false,false,'CAJERO'),", "create or replace function private.abc_cap_catalogo()"].sort()
}, "catálogo: solo cambia el techo de SOLICITAR");
assert.deepEqual(diferencias(orig.tec, nueva.tec), {
  quitadas: ["create function private.abc_cap_techo_permite(p_techo text, p_rol text)"],
  anadidas: ["create or replace function private.abc_cap_techo_permite(p_techo text, p_rol text)", "when 'CAJERO' then p_rol in ('Propietario','Encargado','Cajero/a')"].sort()
}, "techo: solo se añade CAJERO");
// el resto del catálogo: 31 capacidades y solo SOLICITAR con techo CAJERO; CONFIRMAR sigue en ENCARGADO
assert.equal((nueva.cat.match(/^\s+\('ABC_[A-Z_]+','/gm) || []).length, 31);
assert.equal((nueva.cat.match(/'CAJERO'\)/g) || []).length + (nueva.cat.match(/'CAJERO'\),/g) || []).length > 0, true);
assert.match(nueva.cat, /\('ABC_REEMBOLSO_CONFIRMAR','GENERAL',true,true,false,false,'ENCARGADO'\),/, "CONFIRMAR sigue con techo Encargado");
assert.match(nueva.cat, /\('ABC_REEMBOLSO_SOLICITAR','GENERAL',true,true,false,false,'CAJERO'\),/, "la plantilla no cambia: el Cajero/a no la tiene por defecto");

// 4. Solicitar: la aprobación decide si sale el envío.
assert.equal((nueva.sol.match(/PROVIDER_REEMBOLSO/g) || []).length, 1, "un único punto de envío en solicitar");
assert.match(nueva.sol, /if v_auto and v_pago\.medio<>'EFECTIVO' then\s+perform private\.abc_encolar_efecto\(\s+p_empresa_id,p_local_id,p_operation_id,\s+'PROVIDER_REEMBOLSO',/, "solo se encola si está aprobado y no es efectivo");
assert.match(nueva.sol, /v_auto:=private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR'\);\s+insert into public\.reembolsos\(/, "se decide antes de insertar");
assert.match(nueva.sol, /'ABC_REEMBOLSO_SOLICITAR'\s+\) then\s+raise exception 'abc_reembolso_no_autorizado';/, "solicitar sigue exigiendo ABC_REEMBOLSO_SOLICITAR");
assert.match(nueva.sol, /'importe_comprometido',v_importe,\s+'currency_code',v_pago\.payment_currency_code,\s+'requiere_aprobacion',not v_auto,\s+'aprobado',v_auto/, "el resultado dice si requiere aprobación");

// 5. Aprobar (nueva).
const apr = bloque(mig, "create function public.abc_aprobar_reembolso(", "\nend $$;", "aprobar");
assert.match(apr, /create function public\.abc_aprobar_reembolso\(\s+p_operation_id text,\s+p_empresa_id text,\s+p_local_id text,\s+p_reembolso_id uuid,\s+p_terminal_id uuid,\s+p_operating_day date\s+\)\s+returns jsonb\s+language plpgsql\s+volatile\s+security definer\s+set search_path=''/, "firma y atributos");
assert.match(apr, /auth\.uid\(\) is null\s+or not private\.abc_tiene_capacidad\(\s+p_empresa_id,p_local_id,'ABC_REEMBOLSO_CONFIRMAR'\s+\) then\s+raise exception 'abc_aprobar_reembolso_no_autorizado';/, "exige ABC_REEMBOLSO_CONFIRMAR");
assert.match(apr, /'ABC_APROBAR_REEMBOLSO',v_request,p_terminal_id/, "operación idempotente propia");
assert.match(apr, /if \(v_cmd->>'replayed'\)::boolean then\s+return coalesce\(v_cmd->'resultado',v_cmd\);/, "una repetición devuelve lo mismo");
assert.match(apr, /from public\.reembolsos\s+where empresa_id=p_empresa_id\s+and local_id=p_local_id\s+and id=p_reembolso_id\s+for update;/, "bloquea la fila, de la empresa y el local indicados");
assert.match(apr, /if v_reembolso\.estado<>'PENDIENTE' then raise exception 'reembolso_no_aprobable'; end if;\s+if v_reembolso\.aprobado_at is not null then raise exception 'reembolso_ya_aprobado'; end if;/, "solo PENDIENTE y sin aprobar");
assert.match(apr, /if v_reembolso\.created_by=auth\.uid\(\) then\s+raise exception 'reembolso_aprobador_distinto_solicitante';\s+end if;/, "nadie aprueba lo que solicitó él mismo");
assert.match(apr, /update public\.reembolsos\s+set aprobado_por=auth\.uid\(\),\s+aprobado_at=now\(\)\s+where empresa_id=p_empresa_id\s+and local_id=p_local_id\s+and id=p_reembolso_id;/, "deja constancia de quién y cuándo");
assert.match(apr, /'REEMBOLSO_APROBADO',\s+jsonb_build_object\(\s+'pago_id',v_reembolso\.pago_id,\s+'importe',v_reembolso\.importe_solicitado,\s+'automatica',false,\s+'solicitado_por',v_reembolso\.created_by\s+\),\s+auth\.uid\(\),p_terminal_id,now\(\),p_operating_day/, "evento con quién aprueba y quién había solicitado");
assert.match(apr, /if v_pago\.medio<>'EFECTIVO' then\s+perform private\.abc_encolar_efecto\(\s+p_empresa_id,p_local_id,p_operation_id,\s+'PROVIDER_REEMBOLSO',\s+'reembolso:'\|\|p_reembolso_id::text,/, "el envío sale ahora, con la misma clave de deduplicación que antes");
assert.match(apr, /jsonb_build_object\(\s+'reembolso_id',p_reembolso_id,\s+'pago_id',v_reembolso\.pago_id,\s+'importe',v_reembolso\.importe_solicitado,\s+'currency_code',v_pago\.payment_currency_code,\s+'motivo',v_reembolso\.motivo,\s+'terminal_id',p_terminal_id,\s+'operating_day',p_operating_day\s+\)/, "el envío lleva los mismos datos de siempre");
assert.equal((apr.match(/insert into /g) || []).length, 1, "aprobar solo inserta un evento");
assert.doesNotMatch(apr, /\b(delete from|truncate|drop )/i);
assert.match(apr, /'aprobado',true,\s+'aprobado_por',auth\.uid\(\)/, "el resultado confirma la aprobación");

// 6. ACL de la función nueva.
assert.match(mig, /revoke all on function public\.abc_aprobar_reembolso\(text,text,text,uuid,uuid,date\)\s+from public,anon,authenticated,service_role;\s+grant execute on function public\.abc_aprobar_reembolso\(text,text,text,uuid,uuid,date\) to authenticated;/, "solo authenticated puede ejecutarla");
assert.equal((mig.match(/\bgrant\b/gi) || []).length, 1, "un único grant en toda la migración");
assert.equal((mig.match(/\brevoke\b/gi) || []).length, 1, "un único revoke");

// 7. Columnas y copia de lo que ya existía.
assert.match(mig, /alter table public\.reembolsos\s+add column aprobado_por uuid references auth\.users\(id\) on delete restrict,\s+add column aprobado_at timestamptz,\s+add constraint abc_d13_reembolso_aprobacion_par check \(\(aprobado_por is null\) = \(aprobado_at is null\)\);/, "las dos columnas o ninguna");
assert.match(mig, /update public\.reembolsos\s+set aprobado_por=created_by,\s+aprobado_at=created_at\s+where aprobado_at is null;/, "lo que ya existía se da por aprobado al solicitarse");
assert.equal((mig.match(/update public\.reembolsos/g) || []).length, 3, "tres actualizaciones: la copia, aprobar y la confirmación de efectivo (existente)");
assert.equal((mig.match(/insert into public\.reembolsos\(/g) || []).length, 1);
assert.equal((mig.match(/\balter table\b/gi) || []).length, 1, "una única alteración de tablas");

// 8. Lo que NO se toca.
assert.doesNotMatch(mig, /create (or replace )?function public\.abc_(cancelar|resolver)_reembolso/, "cancelar (rechazar) y resolver no se reemplazan");
assert.equal((nueva.sol.match(/private\.abc_max_reembolsable_pago\(/g) || []).length, (orig.sol.match(/private\.abc_max_reembolsable_pago\(/g) || []).length, "el cálculo del saldo reembolsable (pago) no cambia");
assert.equal((nueva.sol.match(/private\.abc_max_reembolsable_venta\(/g) || []).length, (orig.sol.match(/private\.abc_max_reembolsable_venta\(/g) || []).length, "el cálculo del saldo reembolsable (venta) no cambia");
assert.doesNotMatch(mig, /update public\.caja_operaciones|update public\.pagos|delete from public\./, "el dinero y los pagos no se tocan aquí");
assert.equal((mig.match(/insert into public\.caja_operaciones\(/g) || []).length, 1, "el único movimiento de caja es el negativo de la confirmación de efectivo (existente)");

console.log("d13-static-contract: OK");

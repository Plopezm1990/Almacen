import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261024150000_t6_bizum_operativo_simulador.sql"),
  "utf8"
);

// Hoja QA-8 (Etapa 5, T6): Bizum operativo, tratado exactamente igual que
// la tarjeta simulada ya probada (Hoja QA-3). Se inicia con
// abc_iniciar_cobro (ahora admite BIZUM, sin mapearlo nunca a
// TRANSFERENCIA/OTRO, tal como se advirtió en ETAPA5_T6_INICIO_QA) y se
// resuelve con el mismo simulador exclusivo de QA-EMP-A/QA-A1 que ya usa
// tarjeta. Nunca se conecta un proveedor de Bizum real.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  // iniciarCobroCuentaF4 ahora admite BIZUM, igual que TARJETA.
  assert.match(
    contenido,
    /if \(!\["EFECTIVO", "TARJETA", "BIZUM"\]\.includes\(medio\)\) return \{ ok: false, error: "Medio de pago no disponible en este punto\." \};/,
    `${nombre}: iniciarCobroCuentaF4 debe admitir BIZUM, igual que TARJETA`
  );
  assert.match(
    contenido,
    /if \(medio === "BIZUM" && estadoFinal\.ok\) \{\s*\n\s*estadoFinal\.mensaje = "Bizum iniciado en modo simulado \(solo QA\): el intento queda pendiente hasta que el adaptador de proveedor lo resuelva\.";/,
    `${nombre}: debe informar que el intento de Bizum queda pendiente, igual que tarjeta`
  );

  // Botón "Iniciar Bizum (QA)", junto al de tarjeta — NO limitado a QA (la
  // tarjeta tampoco lo está): cualquier empresa puede iniciar un intento,
  // igual que con tarjeta, pero solo QA-EMP-A/QA-A1 tiene hoy un resolutor.
  assert.match(
    contenido,
    /onClick: \(\) => ejecutarCobroF4\("BIZUM", \{ importeObjetivo: importeVisible \}\), disabled: procesandoCobroF4 \|\| !Number\.isFinite\(importeVisible\) \|\| importeVisible <= 0 \}, "Iniciar Bizum \(QA\)"\)/,
    `${nombre}: falta el botón para iniciar un cobro Bizum`
  );

  // El botón "Aprobar pago simulado (solo QA)" (ya existente para tarjeta)
  // debe aparecer también cuando el intento pendiente es de medio BIZUM —
  // reutiliza el mismo resolutor, sin ningún cambio de cliente adicional.
  assert.match(
    contenido,
    /\["TARJETA", "BIZUM"\]\.includes\(pagoDelUltimoIntento\?\.medio\)/,
    `${nombre}: el botón de aprobación simulada debe aparecer también para BIZUM`
  );

  // "Preparar Bizum QA" (el handshake de T6, sin cobro real) se conserva
  // sin cambios junto al nuevo botón operativo.
  assert.match(contenido, /"Bizum QA preparado" : "Preparar Bizum QA"/, `${nombre}: el handshake previo debe seguir disponible`);

  // El código de rechazo del resolutor cambió de nombre al admitir dos
  // medios (abc_qa_simulador_solo_tarjeta → abc_qa_simulador_medio_no_soportado).
  assert.match(
    contenido,
    /if \(msg\.includes\("abc_qa_simulador_medio_no_soportado"\)\) return "El resolvedor simulado solo aprueba intentos de tarjeta o Bizum\.";/,
    `${nombre}: falta la traducción actualizada del rechazo por medio no soportado`
  );
  assert.doesNotMatch(
    contenido,
    /abc_qa_simulador_solo_tarjeta/,
    `${nombre}: no debe quedar la traducción del código de error retirado`
  );
}

// Migración: los tres cambios puntuales, sin tocar nada de efectivo/
// tarjeta/vale regalo ya probado.
assert.match(
  migracion,
  /check \(medio = any \(array\['EFECTIVO','TARJETA','TRANSFERENCIA','OTRO','BIZUM'\]\)\);/,
  "public.pagos debe admitir BIZUM como medio"
);
assert.match(
  migracion,
  /if v_medio not in \('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO','BIZUM'\) then raise exception 'medio_pago_invalido'; end if;/,
  "abc_iniciar_cobro debe admitir BIZUM explícitamente, nunca mapearlo a TRANSFERENCIA/OTRO"
);
assert.match(
  migracion,
  /if v_pago\.medio not in \('TARJETA','BIZUM'\) then\s*\n\s*raise exception 'abc_qa_simulador_medio_no_soportado';/,
  "abc_qa_confirmar_pago_simulado debe admitir BIZUM además de TARJETA"
);
assert.match(
  migracion,
  /v_provider := 'QA_SIMULADO_' \|\| v_pago\.medio;/,
  "El proveedor QA debe derivarse del medio real del pago (distingue BIZUM de TARJETA en el histórico)"
);
// Sigue exclusivo de QA-EMP-A/QA-A1 y de Propietario — nada de esto cambió.
assert.match(migracion, /v_empresa constant text := 'QA-EMP-A';/, "El resolutor debe seguir exclusivo de QA-EMP-A");
assert.match(migracion, /v_local constant text := 'QA-A1';/, "El resolutor debe seguir exclusivo de QA-A1");
assert.match(migracion, /and m\.rol = 'Propietario'/, "El resolutor debe seguir exigiendo rol Propietario");

console.log("PLAN_MAESTRO_ETAPA5_T6_BIZUM_OPERATIVO_UI=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_BIZUM_OPERATIVO_RESOLUTOR=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_BIZUM_OPERATIVO_MIGRACION=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T6_BIZUM_OPERATIVO_CANDADO_QA=PASS");

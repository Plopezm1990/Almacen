import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261024160000_t7_impresion_cajon_simulador.sql"),
  "utf8"
);

// Hoja QA-9 (Etapa 5, T7): impresión y cajón en modo simulador. Pedro
// confirmó (24/10/2026) que no tiene impresora todavía, así que esta
// pieza nunca conecta con ningún aparato real: solo deja constancia de
// lo que se habría enviado a un equipo ya registrado en "Equipos del
// local" (tabla abc_local_equipos, que ya existía como simple catálogo
// — "no los conecta ni los configura"). No se crea ninguna tabla nueva:
// se reutiliza abc_eventos, igual que el resto del histórico del
// proyecto.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  // Las 3 funciones de orquestación.
  assert.match(contenido, /async function listarEquiposT7F4\(tipo\)/, `${nombre}: falta listarEquiposT7F4`);
  assert.match(contenido, /async function imprimirTicketSimuladoF4\(\{ equipoId, checkoutId \} = \{\}\)/, `${nombre}: falta imprimirTicketSimuladoF4`);
  assert.match(contenido, /async function abrirCajonSimuladoF4\(\{ equipoId, motivo, checkoutId \} = \{\}\)/, `${nombre}: falta abrirCajonSimuladoF4`);

  // Reutiliza el catálogo de equipos ya existente, nunca inventa otra
  // fuente de datos.
  assert.match(
    contenido,
    /supabase\.rpc\("abc_listar_equipos_local", \{/,
    `${nombre}: debe reutilizar abc_listar_equipos_local, el catálogo de equipos ya existente`
  );

  // El cajón exige motivo cuando no hay checkout (venta) asociado — misma
  // disciplina que las entradas/salidas de caja.
  assert.match(
    contenido,
    /if \(!checkoutId && !motivoLimpio\) return \{ ok: false, error: "Escribe el motivo para abrir el cajón sin una venta asociada\." \};/,
    `${nombre}: el cajón debe exigir motivo cuando se abre sin una venta asociada`
  );

  // Sección "Imprimir ticket" en Cobro·F4, solo con la cuenta PAGADO
  // (igual que Factura/Ticket-correo/Vale-regalo).
  assert.match(contenido, /"Imprimir ticket"/, `${nombre}: falta la sección de impresión en Cobro·F4`);
  assert.match(
    contenido,
    /onClick: imprimirTicketSimuladoT7F4UI, disabled: procesandoImpresionT7F4 \|\| !equipoImpresoraElegidoT7F4 \}/,
    `${nombre}: el botón de imprimir debe depender de que haya una impresora elegida y no haya otra impresión en curso`
  );

  // Sección "Cajón monedero", siempre visible (como "Vale regalo" y
  // "Movimientos de caja"), no solo dentro de Cobro·F4.
  assert.match(contenido, /function renderCajonT7F4\(\)/, `${nombre}: falta la función de render siempre visible del cajón`);
  assert.match(contenido, /"Abrir cajón \(simulado\)"/, `${nombre}: falta el botón de abrir el cajón`);
  assert.match(
    contenido,
    /renderCajonT7F4\(\),\s*\n\s*renderSalaA07\(\)/,
    `${nombre}: renderCajonT7F4 debe llamarse en el nivel superior del render, no dentro de Cobro·F4`
  );

  // Mensajes que dejan claro, siempre, que es un simulador — nunca debe
  // sonar a una conexión real con un aparato.
  assert.match(contenido, /modo simulador: no hay conexión real con el aparato/, `${nombre}: falta el aviso de modo simulador`);

  // Traducciones de error.
  for (const codigo of [
    "abc_impresion_no_autorizada",
    "impresion_equipo_tipo_incorrecto",
    "impresion_cuenta_no_pagada",
    "abc_cajon_no_autorizado",
    "cajon_motivo_requerido",
    "cajon_equipo_tipo_incorrecto",
  ]) {
    assert.match(
      contenido,
      new RegExp(`msg\\.includes\\("${codigo}"\\)`),
      `${nombre}: falta la traducción del error ${codigo}`
    );
  }

  // Los 4 puntos de conexión: destructuring de crearLogicaVenta, su
  // return, las props de <VentaRapida>, y los parámetros de VentaRapida.
  for (const funcName of ["listarEquiposT7F4", "imprimirTicketSimuladoF4", "abrirCajonSimuladoF4"]) {
    const ocurrencias = contenido.match(new RegExp(`\\b${funcName}\\b`, "g")) || [];
    assert.ok(
      ocurrencias.length >= 4,
      `${nombre}: ${funcName} debe aparecer al menos en los 4 puntos de conexión; encontradas: ${ocurrencias.length}`
    );
  }
}

// Dual-file parity: las 3 funciones de orquestación deben ser idénticas
// carácter a carácter.
{
  const inicioFuente = fuente.indexOf("async function listarEquiposT7F4(");
  const finFuente = fuente.indexOf("\n  // Modalidad de la cuenta al abrirla", inicioFuente);
  const inicioEspejo = espejo.indexOf("async function listarEquiposT7F4(");
  const finEspejo = espejo.indexOf("\n  // Modalidad de la cuenta al abrirla", inicioEspejo);
  assert.ok(inicioFuente > 0 && finFuente > inicioFuente, "fuente: no se pudo delimitar el bloque de orquestación de T7");
  assert.ok(inicioEspejo > 0 && finEspejo > inicioEspejo, "espejo: no se pudo delimitar el bloque de orquestación de T7");
  assert.equal(
    fuente.slice(inicioFuente, finFuente),
    espejo.slice(inicioEspejo, finEspejo),
    "Las funciones listarEquiposT7F4/imprimirTicketSimuladoF4/abrirCajonSimuladoF4 deben ser idénticas entre fuente.js y el espejo de recuperación"
  );
}

// Migración: no crea ninguna tabla nueva, reutiliza abc_eventos y los
// permisos ya existentes del proyecto.
assert.doesNotMatch(migracion, /create table/, "No debe crearse ninguna tabla nueva: se reutiliza abc_eventos");
assert.match(migracion, /create or replace function public\.abc_simular_impresion_ticket/, "Falta abc_simular_impresion_ticket");
assert.match(migracion, /create or replace function public\.abc_simular_apertura_cajon/, "Falta abc_simular_apertura_cajon");
assert.match(
  migracion,
  /not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_COBRO_INICIAR'\)/,
  "Imprimir debe exigir el mismo permiso que iniciar un cobro"
);
assert.match(
  migracion,
  /not private\.abc_tiene_capacidad\(p_empresa_id,p_local_id,'ABC_CAJA_OPERAR'\)/,
  "Abrir el cajón debe exigir el mismo permiso que operar la caja"
);
assert.match(migracion, /if v_checkout\.estado <> 'PAGADO' then raise exception 'impresion_cuenta_no_pagada'; end if;/, "Solo se puede imprimir con la cuenta pagada");
assert.match(migracion, /if v_equipo\.tipo <> 'IMPRESORA_TICKET' then raise exception 'impresion_equipo_tipo_incorrecto'; end if;/, "El equipo de impresión debe ser del tipo correcto");
assert.match(migracion, /if v_equipo\.tipo <> 'CAJON_MONEDERO' then raise exception 'cajon_equipo_tipo_incorrecto'; end if;/, "El equipo de cajón debe ser del tipo correcto");
assert.match(
  migracion,
  /if not exists \(\s*\n\s*select 1 from public\.caja_sesiones s\s*\n\s*where s\.empresa_id=p_empresa_id and s\.local_id=p_local_id and s\.estado='ABIERTA'\s*\n\s*\) then\s*\n\s*raise exception 'sesion_caja_no_abierta';/,
  "El cajón debe exigir una sesión de caja abierta"
);
assert.match(
  migracion,
  /if p_checkout_id is null and v_motivo = '' then raise exception 'cajon_motivo_requerido'; end if;/,
  "El cajón debe exigir motivo cuando se abre sin una venta asociada"
);
assert.match(migracion, /modo simulador: no hay conexión real con el aparato/, "El mensaje del servidor también debe dejar claro que es un simulador");
assert.match(migracion, /grant execute on function public\.abc_simular_impresion_ticket[\s\S]*to authenticated;/, "abc_simular_impresion_ticket debe limitarse a usuarios autenticados");
assert.match(migracion, /grant execute on function public\.abc_simular_apertura_cajon[\s\S]*to authenticated;/, "abc_simular_apertura_cajon debe limitarse a usuarios autenticados");

console.log("PLAN_MAESTRO_ETAPA5_T7_SIMULADOR_UI=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T7_SIMULADOR_SIEMPRE_VISIBLE_CAJON=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T7_SIMULADOR_CONEXION_COMPONENTE=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T7_SIMULADOR_PARIDAD_DUAL=PASS");
console.log("PLAN_MAESTRO_ETAPA5_T7_SIMULADOR_MIGRACION=PASS");

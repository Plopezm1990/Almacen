# Plan Maestro L&A Suite — Etapa 7.1 — contratos de roles, caja y movimientos

Fecha: 26/10/2026  
Entorno de código: rama QA del PR `#175`  
Estado: `CONTRATOS_TECNICOS_PASS; MATRIZ_VIVA_PENDIENTE; ETAPA_7_ABIERTA`

## 1. Alcance de esta tanda

Se ejecutó la siguiente pieza segura de la campaña de Etapa 7.1 sin crear
cuentas, cambiar roles, guardar operaciones ni tocar datos de Supabase:

- contrato de matriz de roles y Caja del TPV;
- contrato de lectura acotada del sincronizador de movimientos;
- regresión del bloque TPV–movimientos–caja de la Etapa 5;
- comprobación de formato del worktree.

El objetivo es separar la certificación de invariantes del código de la
validación viva que requiere entrar con una cuenta QA dedicada por rol.

## 2. Resultado ejecutable

| Contrato | Resultado |
|---|---:|
| `etapa7-role-matrix-caja-contract.mjs` | `PASS` |
| `etapa7-movimientos-sync-read-scope-contract.mjs` | `PASS` |
| `etapa5-tpv-movimientos-caja-contract.mjs` | `PASS` |
| `git diff --check` | `PASS` |

## 3. Invariantes de roles y Caja verificadas

El contrato confirma que:

1. el TPV recibe el rol efectivo de la sesión sin romper la interfaz de
   propiedades existente;
2. si el padre no lo entrega, el TPV intenta resolver el rol remoto de la
   sesión cloud;
3. `Propietario`, `Encargado` y `Cajero/a` pueden operar el bloque Caja;
4. `Camarero/a` no recibe la pestaña interna de Caja;
5. la acción de abrir Caja tiene una defensa de rol antes de llamar al
   servidor;
6. el panel interno de Caja solo se monta para perfiles autorizados.

Esto certifica la barrera estructural y la defensa previa al RPC. No equivale
a una prueba de login real con cuatro cuentas distintas.

## 4. Invariantes del sincronizador de movimientos

El contrato confirma que el guardado por filas:

- lee del servidor únicamente los IDs que debe comparar;
- incluye los IDs marcados explícitamente para borrado;
- no vuelve a leer todo el histórico remoto durante el guardado;
- no bloquea una cola compuesta únicamente por borrados;
- borra solo por IDs que el servidor ha confirmado como visibles.

La corrección conserva el aislamiento ya existente y reduce la carga de
lectura del camino de guardado. El arranque en frío continúa siendo un camino
separado que debe medirse en la campaña viva.

## 5. Qué queda pendiente de la matriz viva

La certificación técnica no sustituye estas comprobaciones operativas:

- iniciar sesión con una cuenta QA de Propietario;
- iniciar sesión con una cuenta QA de Encargado;
- iniciar sesión con una cuenta QA de Cajero/a;
- iniciar sesión con una cuenta QA de Camarero/a;
- confirmar visualmente Caja visible/bloqueada según el rol;
- confirmar que las mutaciones A/B y A1/A2 no cruzan empresa ni local;
- medir tiempos comparables de TPV antiguo y nuevo;
- ejecutar el arranque offline en frío y la recuperación tras recarga;
- validar periféricos reales en T9.

No se deben inventar PIN, reutilizar credenciales de producción ni modificar
roles para cerrar estos puntos.

## 6. Decisión

**Contratos técnicos de roles, Caja y movimientos: PASS.**

La pieza automatizada queda incorporada al expediente de la Etapa 7.1. La
matriz viva por cuentas permanece abierta hasta disponer de credenciales QA
dedicadas y autorizadas.

## 7. Qué sigue

El siguiente paso seguro es preparar o localizar las cuentas QA dedicadas por
rol sin modificar permisos durante la preparación. Una vez disponibles, se
repetirá la navegación del TPV y Caja con cada rol, documentando únicamente
lecturas y controles de acceso. La promoción a producción continúa fuera de
esta tanda.

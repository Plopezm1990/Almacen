# Acta de cierre final · rediseño visual Órbita

**Fecha:** 23/11/2026  
**Rama:** `rediseno/f0-base-qa`  
**PR:** #225, borrador, contra `release`  
**Entorno:** Deploy Preview 225 / QA únicamente  
**Producción:** no modificada  
**SHA de verificación:** `db7ac239` (commit que publica este acta y la matriz consolidada).

## Resultado

El marco visual Órbita queda consolidado para los doce módulos de la suite:
Inicio, TPV y sala, Pase, Cocina, Caja, Clientes, Compras, Inventario,
Personal, Configuración, Plataforma y Acceso. La migración conserva datos,
rutas, permisos, RPC, handlers y paridad de `fuente.js` con
`source-recovery/fuente-recuperado.js`.

## Siete puntos de cierre

1. **Matriz actualizada.** Las filas vigentes reflejan la evidencia live de
   escritorio, móvil, Acceso y Plataforma. Las pasadas anteriores que ya no
   son el estado actual se conservan con `EVIDENCIA_HISTORICA`; no se borró
   ninguna trazabilidad.
2. **Histórico separado.** Las notas antiguas que decían que Plataforma,
   Acceso, Inicio o la pasada móvil estaban pendientes quedan supersedidas por
   las filas y actas del 23/11. Los bloqueos reales de infraestructura,
   permisos o alcance siguen visibles y no se disfrazan de cierre.
3. **Actas y traspaso reconciliados.** Esta acta, `EVIDENCIA_LIVE_ORBITA_2026-11-23.md`,
   `ACTA_PARIDAD_ESTRUCTURA_ORBITA_2026-11-22.md` y
   `TRASPASO_QA_CLAUDE_2026-11-17.md` comparten el mismo alcance: cierre
   visual sí; operaciones destructivas, dinero y tareas de producto futuras,
   fuera del alcance.
4. **Batería final.** Se ejecutaron los 22 scripts de `tests/rediseno/*.mjs`:
   `REDISENO_BATTERY total=22 fallos=0`. Los contratos de marco, rutas,
   componentes, módulos, plantillas, móvil, MFA, Apariencia, fiscalidad,
   arranque y cierre limpio devolvieron `PASS`.
5. **Regresión, paridad y sintaxis.** `python
   source-recovery/recuperar_candidato.py --check` devolvió
   `PARIDAD_CUERPO_EXACTA=1` y `SOURCE_RECOVERY_CHECK=PASS`. `node --check`
   pasó para ambas fuentes. `git diff --check` no produjo salida.
6. **Publicación segura.** El PR #225 permanece en borrador sobre
   `rediseno/f0-base-qa`; no se fusionó, no se ejecutó producción y no se
   tocaron factores MFA, cuentas, empresas, locales ni operaciones destructivas
   durante este cierre documental.
7. **Alcance explícito.** Quedan separados como opcionales o externos al
   objetivo visual: MFA positivo de Cajero/a, paginación/búsqueda avanzada de
   Pase, bookkeeping de migraciones de Apariencia, nuevas operaciones de
   cobro/reembolso/configuración, `acc-08`, `per-21`, `per-24..per-25`,
   `sis-13` y las superficies que pertenecen solo a la maqueta o requieren un
   contrato de producto/backend.

## Evidencia de escritorio y móvil

- Escritorio `1440×900`: TPV/Sala, Cocina, Caja, Clientes, Compras,
  Inventario, Personal y Configuración; shell común persistente.
- Escritorio de administrador: Plataforma, empresas, locales, usuarios,
  estados, salto a la aplicación y retorno a Plataforma.
- Móvil: shell, navegación inferior, Inicio/Pase, TPV, Cocina, Caja,
  Clientes, Compras, Inventario, Personal y Configuración, sin overflow y con
  controles de al menos `44×44 px`.
- Acceso: login, recuperación, selección de empresa/local, expiración, MFA y
  estados de carga/error con presentación Órbita.

## Datos de QA abiertos

No se borró la evidencia de QA. Las cuentas, tickets, comandas y movimientos
de ensayo existentes permanecen según sus actas funcionales. No se generaron
nuevas operaciones económicas para este cierre. La cuenta sintética abierta o
cualquier pendiente funcional debe limpiarse únicamente mediante su ficha
operativa autorizada, nunca mediante `sis-13` ni vaciando QA.

## Criterio de cierre

El objetivo visual se considera cerrado cuando este documento, la matriz y el
traspaso se publican juntos con el SHA final y la batería queda en verde. Las
limitaciones enumeradas no son defectos visuales ocultos: son decisiones de
producto, infraestructura o pruebas funcionales separadas.

# Auditoría completa L&A Suite — inventario, matriz de cobertura y plan por bloques

Fecha: 26/10/2026
Entorno: QA, Deploy Preview `#181` (borrador, sin fusionar) — `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`
Rama auditada: `audit/qa-preview-2026-10-26` (= `codex/etapa5-recuperacion-qa` en commit `1719bdd3`, más un commit sin efecto en la app)
Producción: sin cambios, confirmado sano (ver aviso aparte sobre el rollback del PR #175)

## 0. Resumen ejecutivo

Antes de auditar desde cero, se revisó de forma crítica el trabajo de auditoría no
física de la Etapa 7.1 que ya existía en la rama (~30 documentos, 2026-10-25/26).
Resultado de esa revisión (ejecutando otra vez los tests citados, leyendo el código
real del QR fiscal, buscando evidencia visual):

- **28 contratos automáticos citados como PASS pasan de verdad**, ahora mismo, al
  volver a ejecutarlos — no es narrativa sin respaldo.
- **El QR fiscal tiene una barrera real en SQL** (`qr_fiscal_qa_only`, migración
  `20261026160000_abc_p18_qa_fiscal_qr_ticket.sql` línea 134) que impide cualquier
  vía hacia producción — confirmado leyendo el código, no solo el documento.
- **Ningún documento de los ~30 adjunta una captura de pantalla real.** Todo lo
  "verificado visualmente" es narración en prosa de quien hizo la sesión — no es
  evidencia verificable de forma independiente. Se trata como "observación
  narrada", nunca como "PASS visual" confirmado.
- **Hallazgo nuevo:** el único pase visual documentado del nuevo TPV
  (`DOCUMENTO2_PASE_VISUAL_1_QA_2026-10-26.md`) se hizo sobre un catálogo **vacío**
  ("el navegador informó que las colecciones locales no están disponibles en ese
  entorno") — la cuadrícula de productos con datos reales, que es el objetivo
  central del cambio, sigue sin probarse con contenido de verdad.
- **Riesgo pendiente declarado por el propio documento, sin investigar:** la
  comparación QA Empresa A ↔ QA Empresa B quedó no concluyente porque un traspaso
  de almacén a piso fue rechazado por el servidor sin averiguar la causa.

Esta auditoría se construye sobre esa base: no repite lo ya verificado con tests
reales, se concentra en (a) las pantallas y bloques que ese trabajo previo no tocó
o dejó como narración sin evidencia, y (b) una revisión propia de código/arquitectura
transversal (UX, accesibilidad, duplicación, estado, dinero, permisos).

## 1. Inventario de módulos (extraído del código)

44 pestañas de nivel superior detectadas en `fuente.js` (`tab === "..."`):

`venta` (TPV), `pedidos`, `cocina`, `caja`, `productos`, `proveedores`, `albaranes`,
`recepcion`, `traspasos`, `mermas`, `conteo`, `resumen_almacen`, `historial_producto`,
`etiquetas`, `encargos`, `clientes`, `facturas`, `pagos`, `libroiva`, `descuentos`,
`devoluciones`, `personal`, `turnos`, `fichaje`, `nominas`, `fichas`, `produccion`,
`aceite`, `appcc`, `saldo`, `tesoreria`, `estacionalidad`, `reportes`, `resultados`,
`dashboard`, `buscar`, `mapa`, `direccion`, `locales`, `configuracion`,
`notificaciones`, `respaldos`, `auditoria`, `errores_sistema`, `diagnostico`.

Roles detectados (capacidades/cargos): Propietario, Encargado, Cajero/a, Camarero/a,
Estándar — más granularidad fina por "capacidad" (`ABC_COBRO_INICIAR`,
`ABC_CAJA_OPERAR`, `ABC_CUENTA_REPARTIR`, etc., decenas de capacidades individuales
gestionadas por PM13).

## 2. Matriz de cobertura

Leyenda: ✅ REVISADO (evidencia reproducible: test real + código) · 🟡 PARCIAL
(narración sin evidencia independiente, o cobertura incompleta) · 🔴 BLOQUEADO
(necesita algo que no está disponible ahora) · ⬜ NO APLICA todavía (sin iniciar)

| Bloque | Pantallas | Estado | Motivo |
|---|---|---|---|
| TPV — venta, carrito, cuentas | `venta` | 🟡 PARCIAL | Contratos de backend/aislamiento ✅; el pase visual con catálogo real está pendiente (H4) |
| TPV — cobro, caja, propina, vale regalo | `venta` (Cobro·F4), `caja` | 🟡 PARCIAL | Lógica y permisos ✅ por contrato; interacción visual real (táctil, responsive) sin capturas verificables |
| TPV — recuperar/aparcar cuenta, reparto, sala | `venta` | ✅ REVISADO | `etapa7-role-matrix-caja`, `b11-offline-boundary`, matriz viva de roles con sesión real (ver sección 7 de `ETAPA7_1_CUENTAS_QA_CREADAS_ROLES`) |
| QR fiscal / ticket | `venta` (Cobro·F4) | 🟡 PARCIAL | Barrera SQL y tests ✅; pantalla de ticket con QR real sin captura |
| Puente L&A | (fuera de la app, programa aparte) | 🔴 BLOQUEADO | Sigue sin hardware real, documentado y aceptado desde el 25/10 |
| Pedidos, cocina | `pedidos`, `cocina` | ⬜ NO APLICA todavía | Sin revisar en esta auditoría ni en la previa |
| Productos, proveedores, albaranes, recepción | `productos`, `proveedores`, `albaranes`, `recepcion` | ⬜ NO APLICA todavía | Sin revisar en esta auditoría; Documento2/A04 cubre solo "opciones", no el catálogo general |
| Traspasos, mermas, conteo, almacén | `traspasos`, `mermas`, `conteo`, `resumen_almacen` | 🟡 PARCIAL | El traspaso QA B→piso rechazado (H7) queda sin investigar |
| Encargos, clientes | `encargos`, `clientes` | ⬜ NO APLICA todavía | Sin revisar |
| Facturas, pagos, Libro IVA, descuentos, devoluciones | `facturas`, `pagos`, `libroiva`, `descuentos`, `devoluciones` | 🟡 PARCIAL | Revisión de código completa (ver `AUDITORIA_BLOQUE3_CODIGO_...md`); prueba en vivo con Cowork pendiente de resultado |
| Personal, turnos, fichajes, nóminas, fichas, cargos | `personal`, `turnos`, `fichaje`, `nominas`, `fichas` | 🟡 PARCIAL | Las 3 cuentas QA sintéticas se crearon y probaron (login + matriz), pero solo esa pantalla puntual, no el módulo completo |
| Producción, aceite, APPCC | — | ⬜ NO APLICA todavía | Sin revisar |
| Caja (tesorería), saldo, estacionalidad, reportes, resultados, dashboard | — | ⬜ NO APLICA todavía | Sin revisar |
| Configuración, locales, notificaciones, respaldos | — | ⬜ NO APLICA todavía | Sin revisar en esta auditoría (respaldos tiene el aviso histórico ya conocido de `historialRespaldos`, no relacionado) |
| Auditoría, errores de sistema, diagnóstico | — | ⬜ NO APLICA todavía | Sin revisar |
| Responsive 390/768/1440 px | todas | 🔴 BLOQUEADO | Necesita sesión en vivo (ver sección 3) |
| Accesibilidad (teclado, foco, contraste) | todas | 🔴 BLOQUEADO | Necesita sesión en vivo |
| Errores de consola | todas | 🟡 PARCIAL | Las sesiones previas reportan consola limpia, pero es narración, no un volcado adjunto |

**27 de 44 módulos quedan sin ningún tipo de revisión todavía** (⬜). Esto no es "100%
auditado" ni debe presentarse como tal.

## 3. Bloqueo de acceso en vivo

No tengo credenciales ni sesión de navegador propia (por norma, nunca se gestionan
contraseñas por chat). Las pruebas visuales, de accesibilidad y responsive —
sección 2 del guion original de Pedro — necesitan que Pedro o Cowork las ejecuten
y reporten, igual que el resto de esta sesión. El guion para la primera tanda
(bloque TPV/Cobro/Caja, el de mayor riesgo económico) está en el documento
`AUDITORIA_COWORK_BLOQUE1_TPV_COBRO_2026-10-26.md`.

## 4. Siguiente paso

1. Ejecutar el guion del Bloque 1 (TPV/Cobro/Caja) con Cowork sobre
   `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`.
2. Mientras llega ese resultado, seguir con la auditoría de código/arquitectura
   transversal (componentes duplicados, cálculos monetarios, estado) en paralelo.
3. Preparar el guion del Bloque 2 (Catálogo/Almacén/Traspasos, incluida la
   investigación del rechazo de traspaso en Empresa B) y sucesivos, por orden de
   riesgo económico y de permisos.

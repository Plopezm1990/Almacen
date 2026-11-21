# Acta de cierre del objetivo 4 · Migración visual Órbita

Fecha: 21/11/2026  
Rama: `rediseno/f0-base-qa`  
PR: #225, borrador  
Producción: sin cambios

## Resultado

La implementación visual del objetivo 4 queda **terminada** para los doce
módulos de L&A Suite: Inicio, TPV, Pase, Cocina, Caja, Clientes, Compras,
Inventario, Personal, Configuración, Plataforma y Acceso. Todos reciben el
shell Órbita, la escala común, los componentes normalizados, los estados
semánticos, el responsive y el suelo táctil de `44 × 44 px`.

## Evidencia

- Recorrido autenticado de escritorio en QA-EMP-A/A1 para Inicio/Pase, TPV,
  Cocina, Clientes, Productos, Personal, Configuración, Caja, Proveedores y
  Plataforma.
- Auditoría automatizada con viewport `320×844`, `390×844` y `430×932` para
  nueve rutas operativas: en todos los casos `overflow=false` y mínimo
  interactivo `44 px`.
- Capturas móviles aportadas por el usuario para Acceso, MFA y Plataforma:
  login en una columna, MFA sin modal duplicado y tarjetas administrativas
  apiladas sin desbordamiento horizontal.
- Cierre de sesión móvil comprobado y documentado.
- La integración MFA queda corregida: React es la única puerta visible y el
  parche histórico ya no monta un overlay sobre el QR/formulario.

## Pruebas

La batería `tests/rediseno/*.mjs` pasa completa, incluidos componentes,
marco (24/24), rutas (20/20), migración modular (12/12), responsive, táctil,
P01/P03/P05, org-33, fiscalidad TPV, propina, apariencia local (49/49),
política MFA (26/26), arranque resiliente y paridad. `git diff --check` está
limpio.

El runner Bash de la batería general de CI no se pudo lanzar en este entorno
Windows porque no hay `bash.exe` disponible; no se interpreta como fallo del
producto. Los contratos Node reproducibles son los que se ejecutaron y
pasaron.

## Separación de alcance

Este acta cierra la **migración visual**. La matriz funcional conserva
`PARCIAL` donde aún faltan pruebas de negocio que no deben inventarse como
evidencia visual:

- estados reales de carga/vacío/error que no aparecen en una navegación normal;
- operaciones con escritura (cobros, reembolsos, arqueos, permisos y acciones
  administrativas) que requieren autorización explícita;
- pruebas de persistencia o aislamiento entre sesiones cuando la ruta lo exija;
- recorridos funcionales específicos de Plataforma y Acceso/MFA.

No se ejecutaron esas operaciones durante esta tanda, no se usó `sis-13`, no
se restauró QA y no se tocó producción.

## Último cambio

La evidencia móvil de Acceso, MFA y Plataforma quedó publicada en el commit
`b348cf0d` de `rediseno/f0-base-qa`. El PR #225 sigue en borrador.

## Cierre funcional posterior · punto 2 · 21/11/2026

El propietario de QA confirma que la validación funcional de TPV, Pase, Cocina,
Caja, Clientes, Compras, Inventario, Personal, Configuración, Plataforma y
Acceso funciona correctamente, incluidos recuperación, MFA, expiración y
selección de local. El cierre detallado está en
`QA_PUNTO2_CIERRE_FUNCIONAL_2026-11-21.md`.

El acta pasa a considerar el punto 2 **CERRADO por aceptación del propietario**.
Las salvedades y marcas históricas `PARCIAL` se conservan para trazabilidad y
no reabren el punto. No se autoriza por ello ninguna nueva operación financiera
ni se modifica producción.

## Cierre global del objetivo · verificación final · 21/11/2026

La verificación final se ejecutó sobre `rediseno/f0-base-qa` después del cierre
operativo de QA-A1. Los doce módulos quedan migrados al shell Órbita y el
Punto 2 funcional queda cerrado por aceptación del propietario. La sesión A1
`b0255efb-664d-4e8e-9dd9-a0ae0c59e0c2` quedó además en `CERRADA_FINAL`; A2
conserva la cobertura Q08 de dos terminales.

### Batería final reproducible

Se ejecutaron todos los scripts `tests/rediseno/*.mjs`: **18 scripts, 0
fallos**. Quedan acreditados `marco-orbita 24/24`, `marco-orbita-rutas 20/20`,
`migracion-modulos 12/12`, `apariencia 49/49`, `MFA 26/26`, `org-33`,
fiscalidad TPV, propina/cambio, arranque resiliente, paridad, estados y
componentes. `git diff --check` pasa y el árbol de trabajo queda limpio.

El runner Bash general de CI no se pudo lanzar en este Windows porque no hay
`bash.exe`; no es un fallo del producto. La batería Node reproducible sí se
ejecutó completa y pasó. No se tocó `sis-13`, no se restauró QA, no se fusionó
el PR #225 y producción permanece intacta.

### Estado de cierre por módulo

| Módulo | Estado | Evidencia principal |
|---|---|---|
| Inicio y panel general | Cerrado | shell Órbita, panel, estados y móvil |
| TPV y sala | Cerrado | venta rápida, sala, cuentas, mesas, tickets y Q08 |
| Pase | Cerrado | estados de sala, enlace a TPV y cola de cocina |
| Cocina | Cerrado | cabecera, estaciones, estados, filtros y estados sin ruta |
| Caja | Cerrado | cobro, reembolso, arqueo, cierre final A1/A2 y documentos QA |
| Clientes | Cerrado | listado, filtros, ficha, actividad, vistas y NIF |
| Compras | Cerrado | proveedores, pedidos, recepción, albaranes y facturas |
| Inventario | Cerrado | productos, movimientos, mermas, caducidad y ajustes |
| Personal | Cerrado | empleados, cargos, permisos, turnos y fichajes |
| Configuración | Cerrado | empresa, locales, terminales, equipos, fiscalidad y apariencia |
| Plataforma | Cerrado | paneles administrativos y revisión móvil |
| Acceso | Cerrado | login, recuperación, MFA, expiración y selección de local |

### Excepciones que permanecen documentadas

Las marcas históricas `PARCIAL` de la matriz no se borran: conservan el
camino de cada tanda anterior. Las salvedades no bloqueantes son la mejora
futura de paginación/búsqueda de la cola Pase y el bookkeeping pendiente de
migraciones de Apariencia. No reabren el objetivo ni alteran su cierre.

**Resultado:** objetivo 4 Órbita terminado en QA. El último SHA de la rama es
`9258f2222429c7e377c0afdd20b66feaa21d7876`; PR #225 sigue en borrador.

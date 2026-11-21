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

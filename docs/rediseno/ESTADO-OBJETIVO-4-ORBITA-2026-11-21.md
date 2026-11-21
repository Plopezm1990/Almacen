# Estado del objetivo 4 · migración modular Órbita

Fecha: 21/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador  
Último SHA auditado: `b348cf0d` (evidencia móvil de Acceso, MFA y Plataforma)

## Resultado de la implementación

La migración visual común está integrada para los doce módulos definidos en el
objetivo, sin duplicar handlers ni cambiar contratos de datos:

1. Inicio y panel general
2. TPV y sala
3. Pase
4. Cocina
5. Caja
6. Clientes
7. Compras
8. Inventario
9. Personal
10. Configuración
11. Plataforma
12. Acceso

El shell `la-orbita-shell.js` clasifica las rutas con
`data-la-orbita-module`/`data-la-orbita-surface`, y `la-apariencia.css` aplica
la misma escala a navegación, cabecera, tarjetas, tablas, formularios,
estados, modales, paginación, filtros, iconos y controles táctiles. La capa
remapea además las superficies heredadas que todavía llegan con estilos inline
(MFA, Seguridad/Tema, Reconciliación de stock, cabeceras móviles y botones de
solo icono), sin tocar `fuente.js` ni su espejo de recuperación.

## Comprobaciones reproducibles

En la raíz del repositorio:

```text
node tests/rediseno/p01-capas-y-migraciones-contract.mjs
node tests/rediseno/marco-orbita-contract.mjs
node tests/rediseno/componentes-orbita-contract.mjs
node tests/rediseno/migracion-modulos-contract.mjs
Get-ChildItem tests/rediseno/*.mjs | ForEach-Object { node $_.FullName }
git diff --check
```

Resultado de la última batería: `REDISENO_BATTERY_FAILS=0 TOTAL=18`;
contratos de marco `23/23`, componentes `PASS`, migración modular `12/12`,
responsive `PASS`, táctil mínimo `44 px`, y `git diff --check` limpio.

## Qué queda separado y no se puede cerrar con evidencia estática

La matriz funcional conserva `PARCIAL` deliberadamente. No significa que falte
la capa visual: significa que aún no existe evidencia autenticada completa en
QA para todas las condiciones de negocio de cada fila. En concreto:

- recorrido móvil dedicado de cada ruta autenticada;
- estados reales de carga, vacío y error por módulo;
- Plataforma con una cuenta administradora específica;
- Acceso con recuperación, expiración y MFA real;
- operaciones de negocio que puedan crear datos, cobrar, reembolsar o cambiar
  permisos, siempre con autorización explícita;
- revisión final de persistencia y aislamiento entre sesiones cuando la ruta
  lo exija.

La última sesión integrada caducó al abrir una URL fresca y quedó en la pantalla
de acceso. Por seguridad no se escribieron credenciales en el acta, no se
ejecutaron cobros/reembolsos nuevos, no se usó `sis-13`, no se restauró QA y no
se tocó producción.

## Siguiente paso operativo

Reanudar la validación autenticada siguiendo
`PLAN_VALIDACION_AUTENTICADA_MODULOS_ORBITA_2026-11-21.md`: iniciar sesión en
el preview 225 con una cuenta QA autorizada, registrar cada viewport y estado,
y cerrar una fila funcional solo cuando estén presentes todos sus criterios.
La capa de implementación no necesita otra arquitectura; las tareas
pendientes son de recorrido QA, permisos y datos de ensayo.

## Cierre de implementación visual · 21/11/2026

La auditoría responsive automatizada y las capturas móviles aportadas por el
usuario completan la evidencia de composición para los doce módulos. El acta
de cierre es
[`ACTA_CIERRE_OBJETIVO_4_ORBITA_2026-11-21.md`](./ACTA_CIERRE_OBJETIVO_4_ORBITA_2026-11-21.md).
El objetivo visual queda terminado; la matriz mantiene `PARCIAL` únicamente en
las condiciones funcionales y de negocio que requieren una prueba adicional,
una autorización explícita o una superficie administrativa separada.

## Incidencia de acceso MFA resuelta · 21/11/2026

El bloqueo que impedía escanear el QR no era de la cuenta ni del navegador:
se montaban simultáneamente la pantalla MFA React de `fuente.js` y un overlay
histórico de `edge-auth-patch.js`. La corrección `d99bfac6` deja a React como
única autoridad, observa el montaje para retirar el overlay duplicado y
versiona la URL del parche para evitar caché obsoleta. El preview 225 quedó
verificado en el deploy `6b01e253b24fe5974d813833` con una sola pantalla de
enrolamiento interactiva y sin diálogo superpuesto. La clave TOTP y sus códigos
no se documentan.

## Estado de la validación funcional · sesión Camarero/a · 21/11/2026

La cuenta `qa.permisos.20261116@qa.invalid` fue comprobada en el preview como
Camarero/a de `QA-EMP-A / QA-A1`. La denegación de Caja, arqueo, cierre,
fichajes, recepciones y operación del TPV quedó visible y documentada, sin
crear cobros, reembolsos ni documentos nuevos.

Esta sesión no tiene autoridad para cerrar los recorridos de negocio de los
módulos restantes ni el acceso de Plataforma/MFA. Por tanto la matriz conserva
`PARCIAL` donde faltan propietario, administrador de Plataforma o una cuenta de
ensayo con autorización explícita. El siguiente requisito operativo es abrir
una sesión de propietario y otra de administrador de Plataforma en QA; las
contraseñas y códigos MFA deben introducirse únicamente en el navegador.

## Cierre posterior por aceptación del propietario · punto 2 · 21/11/2026

El propietario confirma que todos los recorridos funcionales del punto 2
funcionan correctamente, incluidos TPV, Pase, Cocina, Caja, Clientes, Compras,
Inventario, Personal, Configuración, Plataforma y Acceso con recuperación,
MFA, expiración y selección de local. El estado vigente del punto 2 pasa a
`CERRADO` por aceptación de QA. El detalle se conserva en
`QA_PUNTO2_CIERRE_FUNCIONAL_2026-11-21.md`; las notas `PARCIAL` anteriores son
históricas y no se eliminan.

## Punto 3 · permisos con cuenta restringida · cerrado · 21/11/2026

La cuenta Camarero/a de QA-A1 no puede cobrar, reembolsar, modificar
configuración ni ejecutar acciones de Plataforma. Solo ve las pantallas
operativas correspondientes a su cargo. La combinación de denegaciones
server-side y comprobación live queda documentada en
`QA_PUNTO3_PERMISOS_RESTRINGIDOS_2026-11-21.md`.

## Estado final del objetivo · 21/11/2026

Con el cierre definitivo de QA-A1 y la batería final de 18 scripts Node sin
fallos, el objetivo de migración de los 12 módulos al marco Órbita queda
**TERMINADO en QA**. El cierre global está en
`ACTA_CIERRE_OBJETIVO_4_ORBITA_2026-11-21.md`; la matriz conserva las notas
históricas para trazabilidad. Último SHA:
`9258f2222429c7e377c0afdd20b66feaa21d7876`.

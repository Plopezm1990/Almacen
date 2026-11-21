# Estado del objetivo 4 · migración modular Órbita

Fecha: 21/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador  
Último SHA auditado: `9b98bb1319e5285fb4482851f71fb358841b7af1`

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

## Incidencia de acceso MFA resuelta · 21/11/2026

El bloqueo que impedía escanear el QR no era de la cuenta ni del navegador:
se montaban simultáneamente la pantalla MFA React de `fuente.js` y un overlay
histórico de `edge-auth-patch.js`. La corrección `d99bfac6` deja a React como
única autoridad, observa el montaje para retirar el overlay duplicado y
versiona la URL del parche para evitar caché obsoleta. El preview 225 quedó
verificado en el deploy `6b01e253b24fe5974d813833` con una sola pantalla de
enrolamiento interactiva y sin diálogo superpuesto. La clave TOTP y sus códigos
no se documentan.

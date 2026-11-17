# L&A Suite · Punto 2 · Nueve propuestas visuales

Fecha: 17 de noviembre de 2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador · solo QA  
Preview de referencia: `https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`

## Alcance

El Punto 2 del plan general no es una pantalla nueva aislada. Es completar y
verificar el sistema de apariencia que permite escoger nueve propuestas,
paletas y colores propios, y comprobar que cada propuesta conserva su
identidad en el panel, la navegación, las composiciones y los tamaños de
ordenador y móvil.

Las nueve propuestas registradas son: **Oliva, Claro, Pulso, Patio, Rumbo,
Sello, Órbita, Ascua y Pase**. La biblioteca contiene seis paletas: Bosque,
Café tostado, Azul ámbar, Amatista, Granada y Ascua. El editor admite seis
campos HEX, importación de cinco o seis valores, prueba temporal, guardado por
empresa, historial, restauración y delegación por cargo.

## Evidencia reproducible cerrada

### Código y contratos

- `tests/rediseno/p05-propuestas-contract.mjs`: **PASS**. Fija los nueve
  identificadores, los seis bloques de paleta, las reglas responsive, el modo
  de movimiento reducido, las piezas de Rumbo y los destinos protegidos de
  Pase.
- `tests/rediseno/p01-capas-y-migraciones-contract.mjs`: **PASS**. Las seis
  capas están enlazadas con marca de caché y huella; las dos migraciones de
  apariencia conservan su superficie pública.
- `tests/rediseno/p02-apariencia-empresa-pglite-contract.mjs`: **49/49 PASS**.
- `tests/rediseno/p03-botones-de-solo-icono-contract.mjs`: **PASS**, sin
  botones mudos.
- `tests/rediseno/p04-mfa-politica-pglite-contract.mjs`: **26/26 PASS**.
- Manifiesto CI: **353 contratos activos, 1 histórico, 11 utilidades y 5
  diagnósticos; 370 entradas**. La prueba negativa del validador también
  pasa.

### Banco aislado

El banco `docs/rediseno/banco-apariencia/index.html` cubre nueve diseños, seis
paletas y las 54 combinaciones diseño × paleta, contraste, importación de HEX,
revisiones, restauración, prueba temporal, permisos y controles táctiles. El
panel de `pase.html` cubre el plano de sala, estados, cola, filtros, accesos,
Ascua, permisos, cambio de local, respuestas tardías y el suelo táctil de
44×44 px. Estas pruebas no escriben en QA.

### Corrección incluida en esta tanda

La corrección de destinos Pase → TPV había cambiado `la-pase-panel.js`, pero
`index.html` conservaba la marca de caché anterior. Se renovó la marca a
`qa-destinos-exactos-20261117` y se fijó la nueva huella en P01. Sin este cambio
el navegador podía servir el panel viejo aunque el archivo nuevo estuviera en
el despliegue.

## Cobertura por propuesta

| Propuesta | Composición y comportamiento acreditados | Pendiente real |
|---|---|---|
| Oliva | Tokens de marca y panel general con accesos e indicadores | Repetir recorrido completo en preview con esta propuesta aplicada |
| Claro | Cabecera por áreas y navegación compacta | Repetir recorrido completo en preview |
| Pulso | Panel analítico denso, indicadores y accesos operativos | Repetir recorrido completo en preview |
| Patio | Panel orientado a turno y accesos táctiles amplios | Repetir recorrido completo en preview |
| Rumbo | Ctrl/⌘K, búsqueda por permiso/sinónimo, teclado, foco, fijadas y recientes en `localStorage` por contexto | Falta repetir en preview la persistencia y el salto a un registro concreto; el control de navegador quedó bloqueado por la política URL de Windows en esta tanda |
| Sello | Cabecera corporativa, serif de títulos, agrupación Ventas/Almacén/Equipo/Control y panel de gestión | Repetir recorrido completo en preview |
| Órbita | Carbón/acero/coral, titular degradado, cristal, iconos, entrada al hacer scroll, línea de puntero y alternativa de movimiento reducido; ahora expone ventas registradas calculadas del ledger y enlaza a Resultados | Ocupación y comandas solo deben añadirse cuando exista un contrato/contexto de datos verificable; no se inventan cifras |
| Ascua | Esfera de ocupación, sala, caja y accesos sobre los contratos reales de Pase | Repetir recorrido completo en preview con lectura de datos reales |
| Pase | Plano de sala, estados, cola, filtros, accesos y protección del destino mesa/cuenta | Repetir live los tres destinos con la marca nueva; la regresión ya está corregida y no debe haber fallback silencioso |

## Estado de cierre

El sistema está **integrado y cubierto en código y banco**, pero el Punto 2 no
se marca todavía como cerrado al 100 % porque quedan dos comprobaciones que
solo son honestas en el preview autenticado:

1. Rumbo: fijar/recuperar un destino y abrir un registro concreto en otra
   sesión/contexto.
2. Repetir las composiciones de las nueve propuestas en desktop y móvil y
   resolver, con contratos reales, los indicadores de Órbita que no existen en
   el `Dashboard` actual.

El intento de reabrir el preview desde el control de navegador de Windows fue
bloqueado por la política de URL del entorno. No se ha tocado ninguna sesión ni
se ha ejecutado una operación económica para compensarlo.

## Siguiente tanda exacta

1. Publicar el commit de esta tanda y verificar que el preview sirve la nueva
   marca de `la-pase-panel.js`.
2. Con un propietario autenticado, aplicar temporalmente cada propuesta y
   medir 1440×900, 1024, 430, 390 y 320 px; guardar solo evidencia, no cambios
   económicos.
3. En Rumbo, fijar un destino permitido, recargar, abrirlo y comprobar el
   retorno de foco; repetir en un segundo contexto.
4. En Órbita, decidir qué RPC o prop proporcionará ocupación y comandas. Las
   ventas ya usan el ledger real; si no existe contrato para los otros dos,
   mantenerlos fuera del panel y documentar la dependencia, nunca presentar
   ceros como datos reales.
5. Actualizar la matriz y este acta con el SHA del preview. Mantener PR #225 en
   borrador y no tocar producción.

## Pruebas ejecutadas en esta tanda

```text
REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1
REDISENO_P05_PROPUESTAS_OK=1 disenos=9 paletas=6 rumbo=PASS pase=PASS responsive=PASS reduced_motion=PASS
APARIENCIA_LOCAL=PASS (49/49)
REDISENO_P03_BOTONES_SOLO_ICONO_OK=1 solo_icono=3 mudos=0
MFA_POLITICA=PASS (26/26)
MANIFEST_VALIDATION=PASS (370 entradas)
git diff --check=PASS
```

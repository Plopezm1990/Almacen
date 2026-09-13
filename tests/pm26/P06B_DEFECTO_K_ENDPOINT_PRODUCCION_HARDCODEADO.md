# PM26 — Defecto K (nuevo): endpoint de producción hardcodeado en el flujo público de prefiltro

## Estado

**Registrado, sin corregir. Ningún cambio aplicado, ninguna prueba
viva ejecutada contra QA ni producción.** Se separa deliberadamente
del aviso F (RLS/grants de `prefiltros_candidatos`) — son dos defectos
distintos con causas y correcciones distintas.

## Qué es

Hallazgo incidental de la investigación del aviso F
(`tests/pm26/P06B_AVISO_F_INVESTIGACION.md`, sección 2.3). El
componente público `PrefiltroPublico` (ruta `#/prefiltro/<token>`, sin
sesión) llama a la Edge Function `prefiltro-candidato` con una URL
**codificada literalmente al proyecto de producción** dentro de
`fuente.js`:

```js
fetch("https://<proyecto-de-producción>.supabase.co/functions/v1/prefiltro-candidato", ...)
```

(la URL real, con el identificador del proyecto de producción, está
en `fuente.js` — no se repite aquí para no introducir un identificador
interno en un documento nuevo, siguiendo la misma regla aplicada ya en
`P05A_DIAGNOSTICO_DEFECTO_E.md`.)

A diferencia del resto de la aplicación, que resuelve su conexión a
Supabase de forma dinámica según el entorno (`window.__nubeCliente`,
con distinción QA/producción ya establecida en gran parte del Plan
Maestro), este único flujo **siempre habla con producción**, se
ejecute el bundle desde donde se ejecute — incluido un Deploy Preview
o la propia QA.

## Por qué es un defecto distinto del aviso F

- El aviso F trata permisos/RLS **dentro** de una base de datos (QA).
- El defecto K trata **a qué proyecto se conecta** ese flujo concreto
  — es un problema de aislamiento QA/producción, de la misma familia
  que el defecto E (Netlify) pero en Supabase, no un problema de
  permisos dentro de una base de datos.
- Corregirlo no cambia ninguna política ni grant — cambiaría, como
  mínimo, código de `fuente.js` (de dónde lee la URL de la función) y
  posiblemente variables de entorno/configuración de build.

## Alcance de una eventual corrección (propuesta de plan, no ejecutado)

Sin decidir todavía, dos formas de abordarlo:

1. **Resolver la URL dinámicamente**, igual que el resto de la app
   (a partir de la misma configuración que usa
   `window.__nubeCliente` para elegir QA/producción), en vez de un
   literal.
2. **Mantener la URL fija a producción de forma deliberada**, si se
   decide que el flujo de candidatos debe ser siempre contra
   producción incluso en Deploy Preview (razón de negocio válida:
   candidatos reales no deberían depender de qué entorno sirve la
   página) — en cuyo caso el defecto pasaría a ser un comportamiento
   documentado, no un defecto, y bastaría con dejarlo explícito en
   código/documentación.

Cualquiera de las dos requiere que el usuario decida la intención real
antes de tocar código — no se asume ninguna de las dos.

**Condición explícita del usuario**: este defecto debe resolverse
antes de ejecutar cualquier prueba viva del flujo de prefiltros
(candidato o personal) contra QA o producción — no solo antes de
corregirlo por su cuenta.

## Qué NO se hizo

- No se modificó `fuente.js` ni ningún otro archivo de la aplicación.
- No se ejecutó ninguna prueba viva contra la Edge Function
  `prefiltro-candidato`, ni en QA ni en producción.
- No se mezcló con el aviso F.
- No se corrigió nada — solo se registra el defecto y dos alternativas
  de alcance, a la espera de que el usuario decida antes de que se
  presente un plan más detallado.

```
PM26_DEFECTO_K_ESTADO=REGISTRADO_SIN_CORREGIR
PM26_DEFECTO_K_CORREGIDO=NO
PM26_DEFECTO_K_PRUEBAS_VIVAS_EJECUTADAS=NO
PM26_DEFECTO_K_MEZCLADO_CON_AVISO_F=NO
PM26_DEFECTO_K_DECISION_PENDIENTE=RESOLVER_DINAMICO_O_MANTENER_DELIBERADO
PM26_DEFECTO_K_BLOQUEA_PRUEBAS_VIVAS_DE_PREFILTROS=SI
```

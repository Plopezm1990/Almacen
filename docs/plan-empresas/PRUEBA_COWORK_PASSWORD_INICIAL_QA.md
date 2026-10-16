# Prueba del blindaje de la contraseña inicial en QA con Cowork (D01, decisión 3)

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`). Cuentas ficticias `@qa.invalid`. **No tocar producción.**
Preparado por Claude el 16/10/2026, después de aplicar en QA (commit `21e48a7`) las tres migraciones del blindaje. Estado de QA para la prueba: la cuenta `owner.a@qa.invalid` sigue siendo la administradora de la plataforma; la función `plataforma-crear-propietario` está desplegada. Esta prueba no necesita ningún cambio de código ni un despliegue nuevo: todo lo que comprueba ya está activo en la base de datos de QA.

## Qué comprueba esta prueba y por qué hace falta

La vez anterior (hoja de autorización, §6.2) solo se pudo comprobar el bloqueo y desbloqueo **simulando** la marca con una función interna, sobre la cuenta compartida `Propietario QA`, para no tocar su contraseña real. Eso deja sin probar la pieza más importante: el disparador que detecta un cambio **real** de `encrypted_password` en `auth.users`. Esta prueba da de alta un dueño **nuevo** de verdad (cuenta ficticia, no compartida con nadie) y le hace cambiar su contraseña por la vía real (`auth.updateUser({ password: ... })`, la misma llamada que hace la pantalla «Elige tu contraseña»), para comprobar de principio a fin:
1. Un dueño recién creado queda bloqueado (RPC de estado, y los tres filtros reales: ABC, `almacen_kv`, `movimientos_registro`, y la política de `suscripciones_push`).
2. Al cambiar de verdad la contraseña, el disparador borra la marca y los cuatro bloqueos se levantan solos, sin que nadie tenga que tocar la base de datos a mano.

No repite aquí los contratos completos de regresión de ABC/F4/F4e (quedan como tarea aparte, punto pendiente ya anotado en la hoja de autorización); esta prueba se centra solo en la pieza nueva.

## Antes de empezar

- Usa SOLO la vista previa `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca la dirección de producción, sin «deploy-preview»).
- Si el navegador ya se usó antes para otra prueba de QA y algo no carga bien, borra los datos del sitio: esto incluye cookies, almacenamiento local y de sesión, bases IndexedDB, **caché y service workers** (no basta con borrar solo cookies). Si el problema sigue después de borrar, pide una vista previa nueva en vez de repetir el borrado sobre la misma dirección.
- Es una prueba de consola (como las de la Fase 1 y la Fase 4), no de clics en pantalla: es la única forma de comprobar con precisión cada paso sin ambigüedad.

## Texto para pegar en Cowork

> Eres Cowork. Haz esta prueba SOLO en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción `chic-entremet-9107cf.netlify.app` sin «deploy-preview»). Es una prueba de lectura/escritura en QA con una cuenta ficticia nueva. Para en la primera diferencia y cuéntamela; no intentes arreglar nada.
>
> 1. Abre la vista previa e inicia sesión como `owner.a@qa.invalid` (la cuenta de QA «QA Propietario A», con su contraseña de pruebas). Espera a que cargue el programa.
> 2. Abre la consola del navegador (F12 → Console), pega TODO el bloque de código de abajo y pulsa Intro. Tarda unos segundos. Al final imprime una tabla «RESULTADO_PRUEBA_PASSWORD».
> 3. Copia el resultado completo (texto) y pégamelo. No hace falta que copies ninguna clave real: el código solo usa contraseñas de prueba fijas y no imprime claves del proyecto.
> 4. Cuéntame también si el programa mostró algún error en pantalla durante la prueba.

```js
(async () => {
  const sb = await window.getSupabaseClient();
  const url = sb.supabaseUrl, key = sb.supabaseKey;
  const R = [];
  const resumen = (r) => ({ error: r.error ? (r.error.code || '') + ' ' + r.error.message : null, data: r.data == null ? null : JSON.stringify(r.data).slice(0, 220) });
  const paso = (n, v) => { R.push({ paso: n, ...v }); };
  const tokAdmin = (await sb.auth.getSession()).data.session.access_token;
  const llamar = async (tok, cuerpo) => {
    const r = await fetch(url + '/functions/v1/plataforma-crear-propietario', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: key }, body: JSON.stringify(cuerpo) });
    return { http: r.status, cuerpo: await r.json().catch(() => null) };
  };
  const id = Date.now().toString(36);
  const email = 'duena.password.' + id + '@qa.invalid';
  const passInicial = 'ClaveInicialPrueba2026';
  const passNueva = 'ClaveDefinitivaPrueba2026';

  paso('01 estado del administrador', resumen(await sb.rpc('plataforma_estado')));

  const alta = await sb.rpc('plataforma_crear_empresa', { p_operation_id: 'qa-password-alta-' + id, p_nombre: 'QA Cliente Prueba Password ' + id, p_local_nombre: 'Local QA Password', p_cif: null, p_propietario_user_id: null });
  paso('02 alta de empresa', resumen(alta));
  const empresaId = alta.data && alta.data.empresa_id, localId = alta.data && alta.data.local_id;
  if (!empresaId) { console.log('RESULTADO_PRUEBA_PASSWORD', JSON.stringify(R, null, 1)); return; }

  paso('03 cuenta del dueño nuevo (debe dar 200)', await llamar(tokAdmin, { empresaId, nombre: 'Dueña Prueba Password', email, password: passInicial }));

  const dueno = new sb.constructor(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'qa-password-dueno-' + id } });
  const login = await dueno.auth.signInWithPassword({ email, password: passInicial });
  paso('04 el dueño nuevo inicia sesión', { error: login.error ? login.error.message : null, ok: !!(login.data && login.data.session) });
  if (!(login.data && login.data.session)) { console.log('RESULTADO_PRUEBA_PASSWORD', JSON.stringify(R, null, 1)); return; }
  const uid = login.data.session.user.id;

  paso('05 ANTES de cambiar: estado de contraseña (pendiente:true esperado)', resumen(await dueno.rpc('plataforma_mi_estado_password')));
  paso('06 ANTES: leer su local por ABC (debe fallar)', resumen(await dueno.rpc('abc_obtener_modalidades_local', { p_empresa_id: empresaId, p_local_id: localId })));
  paso('07 ANTES: leer almacen_kv de su empresa (debe devolver 0 filas)', resumen(await dueno.from('almacen_kv').select('key,value').eq('empresa_id', empresaId).eq('key', 'productos')));
  paso('08 ANTES: insertar en movimientos_registro (debe fallar)', resumen(await dueno.from('movimientos_registro').insert({ id: 'qa-password-mov-antes-' + id, fecha: new Date().toISOString().slice(0, 10), datos: { empresaId, prueba: 'password-antes' }, empresa_id: empresaId, local_id: localId })));
  paso('09 ANTES: insertar una suscripción push (debe fallar)', resumen(await dueno.from('suscripciones_push').insert({ endpoint: 'https://prueba.invalid/antes-' + id, p256dh: 'clave-prueba', auth: 'auth-prueba', user_id: uid })));

  const cambio = await dueno.auth.updateUser({ password: passNueva, data: { debe_cambiar_contrasena: false } });
  paso('10 el dueño cambia de verdad su contraseña (ok esperado)', { error: cambio.error ? cambio.error.message : null, ok: !cambio.error });

  paso('11 DESPUÉS: estado de contraseña (pendiente:false esperado)', resumen(await dueno.rpc('plataforma_mi_estado_password')));
  paso('12 DESPUÉS: leer su local por ABC (debe funcionar)', resumen(await dueno.rpc('abc_obtener_modalidades_local', { p_empresa_id: empresaId, p_local_id: localId })));
  paso('13 DESPUÉS: leer almacen_kv de su empresa (debe devolver 1 fila)', resumen(await dueno.from('almacen_kv').select('key,value').eq('empresa_id', empresaId).eq('key', 'productos')));
  paso('14 DESPUÉS: insertar en movimientos_registro (debe funcionar)', resumen(await dueno.from('movimientos_registro').insert({ id: 'qa-password-mov-despues-' + id, fecha: new Date().toISOString().slice(0, 10), datos: { empresaId, prueba: 'password-despues' }, empresa_id: empresaId, local_id: localId }).select()));
  paso('15 DESPUÉS: insertar una suscripción push (debe funcionar)', resumen(await dueno.from('suscripciones_push').insert({ endpoint: 'https://prueba.invalid/despues-' + id, p256dh: 'clave-prueba', auth: 'auth-prueba', user_id: uid }).select()));

  const relog = await dueno.auth.signInWithPassword({ email, password: passNueva });
  paso('16 el dueño vuelve a entrar con la contraseña NUEVA (ok esperado)', { error: relog.error ? relog.error.message : null, ok: !!(relog.data && relog.data.session) });
  await dueno.auth.signOut().catch(() => {});

  paso('17 estado final del administrador (recuentos)', resumen(await sb.rpc('plataforma_estado')));

  console.log('RESULTADO_PRUEBA_PASSWORD', JSON.stringify(R, null, 1));
  return R;
})();
```

## Resultado esperado (para comparar)
| Paso | Esperado |
|---|---|
| 01 | `es_admin: true` y recuentos de empresas |
| 02 | `ok: true` con `empresa_id` (`empresa-…`) y `local_id` (`local-…`) |
| 03 | http 200, `ok: true`, `userId` |
| 04 | inicio de sesión correcto |
| 05 | `ok: true`, **`pendiente: true`** |
| 06 | **ok, sin error** (ver nota debajo de la tabla — esta función no pasa por el blindaje) |
| 07 | `data: "[]"` (ninguna fila visible) |
| 08 | error (bloqueado: viola la política de seguridad de fila, código `42501`) |
| 09 | error (bloqueado: código `42501`) |
| 10 | `ok: true`, sin error — el cambio de contraseña real se aceptó |
| 11 | `ok: true`, **`pendiente: false`** |
| 12 | datos de modalidades por defecto (igual que en el paso 06: esta función nunca estuvo bloqueada) |
| 13 | una fila con `key: "productos"` |
| 14 | `ok: true` (inserción aceptada, fila devuelta) |
| 15 | `ok: true` (inserción aceptada, fila devuelta) |
| 16 | inicio de sesión correcto con la contraseña nueva |
| 17 | recuentos del administrador sin cambios inesperados |

**Diferencia clave a vigilar:** si el paso 05 ya diera `pendiente: false` (sin haber cambiado todavía la contraseña), o si los pasos 07-09 NO fallaran, el bloqueo no estaría funcionando para cuentas nuevas — es la señal de alarma más importante de esta prueba. Si el paso 11 sigue dando `pendiente: true` después de un cambio de contraseña aceptado en el paso 10, el disparador no estaría detectando el cambio real.

**Nota sobre los pasos 06 y 12 (`abc_obtener_modalidades_local`):** esta función NO pasa por `private.abc_tiene_capacidad` — comprobado en `supabase/migrations/20261002220000_abc_config_pieza3_modalidades.sql`, es de solo lectura y solo exige pertenecer al local (`private.la_tiene_local`), un control anterior a este blindaje y fuera de su alcance. Por eso da el mismo resultado («ok») antes y después de cambiar la contraseña: nunca estuvo bloqueada, ni debía estarlo con el diseño actual. No demuestra nada sobre si `abc_tiene_capacidad` bloquea o no — para eso haría falta otra función que sí la use (por ejemplo `abc_abrir_cuenta`, que exige una jornada operativa abierta y por eso no se incluyó en esta prueba). La protección real de `abc_tiene_capacidad` para cuentas nuevas sigue sin tener aquí una prueba en vivo con disparador real; sí está probada contra el texto exacto de la función en el contrato local `tests/plataforma/db/p12-password-inicial-filtros-reales-contract.mjs` (con prueba de mutación) y en vivo en QA con la marca simulada sobre `Propietario QA` (hoja de autorización, §6.2).

## Qué queda en QA después
- Una empresa «QA Cliente Prueba Password …» con su local y la cuenta del dueño `duena.password.….@qa.invalid`, con su contraseña ya cambiada a la «nueva» de la prueba (no a la inicial). Fictícia, no comparte nada con `owner.a@qa.invalid` ni con `Propietario QA`.
- Una fila de prueba en `movimientos_registro` (paso 14) y otra en `suscripciones_push` (paso 15), ambas con datos ficticios inofensivos (el intento del paso 08/09, bloqueado, no deja fila).
- **No se borra nada a mano:** se deja para la fase de borrado definitivo, igual que las empresas de prueba de la Fase 1/4.

## Lo que sigue quedando pendiente (no es parte de esta prueba)
1. Repetir los contratos de regresión existentes de ABC/F4/F4e contra QA (aparte, no incluido aquí para no mezclar objetivos).
2. Cambiar la pantalla para que consulte `plataforma_mi_estado_password()` en vez de `user_metadata` (subpunto de código posterior).
3. Aplicar las tres migraciones en PRODUCCIÓN — autorización escrita aparte.
4. Auditar las funciones que no pasan por estos filtros comunes.

# Prueba de la Fase 1 en QA con Cowork (alta de empresa, cuenta del dueño, baja y reactivación)

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`). Cuentas ficticias `@qa.invalid`. **No tocar producción.**
Preparado por Claude el 9/10/2026. Estado de QA para la prueba: la cuenta `owner.a@qa.invalid` está registrada como administradora de la plataforma; la función `plataforma-crear-propietario` (versión 1) está desplegada.

## Texto para pegar en Cowork

> Eres Cowork. Haz esta prueba SOLO en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción `chic-entremet-9107cf.netlify.app` sin «deploy-preview»). Es una prueba de lectura/escritura en QA con cuentas ficticias. Para en la primera diferencia y cuéntamela; no intentes arreglar nada.
>
> 1. Abre la vista previa e inicia sesión como `owner.a@qa.invalid` (la cuenta de QA «QA Propietario A», con su contraseña de pruebas). Espera a que cargue el programa.
> 2. Abre la consola del navegador (F12 → Console), pega TODO el bloque de código de abajo y pulsa Intro. Tarda unos segundos. Al final imprime una tabla «RESULTADO_PRUEBA_FASE1».
> 3. Copia el resultado completo (texto) y pégamelo. No hace falta que copies ninguna clave: el código no imprime claves ni contraseñas reales.
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
  const email = 'duena.f1.' + id + '@qa.invalid', password = 'ClavePrueba2026F1';

  paso('01 estado del administrador', resumen(await sb.rpc('plataforma_estado')));
  const alta = await sb.rpc('plataforma_crear_empresa', { p_operation_id: 'qa-f1-alta-' + id, p_nombre: 'QA Cliente Prueba F1 ' + id, p_local_nombre: 'Local QA F1', p_cif: null, p_propietario_user_id: null });
  paso('02 alta de empresa', resumen(alta));
  const empresaId = alta.data && alta.data.empresa_id, localId = alta.data && alta.data.local_id;
  if (!empresaId) { console.log('RESULTADO_PRUEBA_FASE1', JSON.stringify(R, null, 1)); return; }

  paso('03 cuenta del dueño con contraseña débil (debe dar 400)', await llamar(tokAdmin, { empresaId, nombre: 'Dueña Prueba F1', email, password: 'corta1' }));
  paso('04 cuenta del dueño correcta (debe dar 200)', await llamar(tokAdmin, { empresaId, nombre: 'Dueña Prueba F1', email, password }));
  paso('05 repetir el mismo correo (debe dar 409)', await llamar(tokAdmin, { empresaId, nombre: 'Dueña Prueba F1', email, password }));
  paso('06 empresa que no existe (debe dar 404)', await llamar(tokAdmin, { empresaId: 'empresa-no-existe', nombre: 'Dueña Prueba F1', email: 'otra.' + email, password }));
  const lista = await sb.rpc('plataforma_listar_empresas');
  const mia = (lista.data || []).find((x) => x.id === empresaId);
  paso('07 listado: la empresa nueva con su dueño', { data: JSON.stringify(mia || null).slice(0, 400) });

  const dueno = new sb.constructor(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'qa-f1-dueno-' + id } });
  const login = await dueno.auth.signInWithPassword({ email, password });
  paso('08 el dueño inicia sesión', { error: login.error ? login.error.message : null, ok: !!(login.data && login.data.session) });
  if (login.data && login.data.session) {
    const tokDueno = login.data.session.access_token;
    paso('09 el dueño no es administrador', resumen(await dueno.rpc('plataforma_estado')));
    paso('10 el dueño intenta listar empresas (debe fallar)', resumen(await dueno.rpc('plataforma_listar_empresas')));
    paso('11 el dueño intenta crear empresa (debe fallar)', resumen(await dueno.rpc('plataforma_crear_empresa', { p_operation_id: 'qa-f1-intento-' + id, p_nombre: 'Intento del dueño ' + id, p_local_nombre: 'Local', p_cif: null, p_propietario_user_id: null })));
    paso('12 el dueño llama a la función de crear dueños (debe dar 403)', await llamar(tokDueno, { empresaId, nombre: 'X Y', email: 'x.' + email, password }));
    paso('13 el dueño lee la configuración de SU local (debe funcionar)', resumen(await dueno.rpc('abc_obtener_modalidades_local', { p_empresa_id: empresaId, p_local_id: localId })));
    paso('14 el dueño lee la configuración del local de OTRA empresa (debe fallar)', resumen(await dueno.rpc('abc_obtener_modalidades_local', { p_empresa_id: 'QA-EMP-A', p_local_id: 'QA-A1' })));
    paso('15 dar de baja la empresa', resumen(await sb.rpc('plataforma_desactivar_empresa', { p_operation_id: 'qa-f1-baja-' + id, p_empresa_id: empresaId, p_motivo: 'prueba Cowork fase 1' })));
    paso('16 tras la baja el dueño ya no puede leer su local (debe fallar)', resumen(await dueno.rpc('abc_obtener_modalidades_local', { p_empresa_id: empresaId, p_local_id: localId })));
    paso('17 reactivar la empresa', resumen(await sb.rpc('plataforma_reactivar_empresa', { p_operation_id: 'qa-f1-reactivar-' + id, p_empresa_id: empresaId })));
    paso('18 tras reactivar el dueño vuelve a leer su local (debe funcionar)', resumen(await dueno.rpc('abc_obtener_modalidades_local', { p_empresa_id: empresaId, p_local_id: localId })));
    await dueno.auth.signOut().catch(() => {});
  }
  const lista2 = await sb.rpc('plataforma_listar_empresas');
  const mia2 = (lista2.data || []).find((x) => x.id === empresaId);
  paso('19 listado final', { data: JSON.stringify(mia2 || null).slice(0, 400) });
  console.log('RESULTADO_PRUEBA_FASE1', JSON.stringify(R, null, 1));
  return R;
})();
```

## Resultado esperado (para comparar)
| Paso | Esperado |
|---|---|
| 01 | `es_admin: true` y recuentos de empresas |
| 02 | `ok: true` con `empresa_id` (`empresa-…`) y `local_id` (`local-…`) |
| 03 | http 400, «La contraseña debe tener al menos 10 caracteres.» |
| 04 | http 200, `ok: true`, `userId` |
| 05 | http 409, «Ya existe una cuenta con ese correo.» |
| 06 | http 404, «Empresa no encontrada.» |
| 07 | la empresa con `usuarios_activos: 1` y un propietario con el correo de la prueba |
| 08 | inicio de sesión correcto |
| 09 | `es_admin: false` |
| 10, 11 | error `42501 Administrador de plataforma requerido` |
| 12 | http 403, «Solo el administrador de la plataforma puede hacer esto.» |
| 13 | datos de modalidades por defecto (`habilitadas: [BARRA, MESA, …]`) |
| 14 | error (`abc_config_no_autorizado`) |
| 15 | `ok: true`, `membresias_desactivadas: 1`, `locales_desactivados: 1` |
| 16 | error (`abc_config_no_autorizado`) |
| 17 | `ok: true`, `locales_reactivados: 1`, `membresias_reactivadas: 1` |
| 18 | datos de modalidades otra vez |
| 19 | la empresa sin baja (`baja_en: null`) |

## Qué queda en QA después
Una empresa «QA Cliente Prueba F1 …» con su local y la cuenta del dueño `duena.f1.….@qa.invalid`. **No se borran a mano:** se dejan para ensayar el borrado definitivo de la Fase 2 (la cuenta de acceso y la empresa deben desaparecer sin dejar restos).

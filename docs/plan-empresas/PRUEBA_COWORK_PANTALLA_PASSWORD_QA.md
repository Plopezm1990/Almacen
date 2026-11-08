# Prueba de la PANTALLA «Elige tu contraseña» en QA con Cowork (D01, decisión 3)

Solo QA (`qjqorixtkilwsndqayyx`, vista previa `deploy-preview-118--chic-entremet-9107cf.netlify.app`). Cuentas ficticias `@qa.invalid`. **No tocar producción.**
Preparado por Claude el 16/10/2026. Hoy esta vista previa concreta se reconstruyó con el commit `e7bcef5` (incluye el cambio de pantalla: ya consulta al servidor en vez de fiarse del dato local).

## Qué comprueba esta prueba y por qué hace falta

La ronda anterior comprobó con un script de consola que el bloqueo funciona en el servidor (RPC y RLS). Lo que falta es ver la **pantalla de verdad**: que «Elige tu contraseña» aparezca o no según lo que diga el servidor, no según un dato guardado en el navegador. Por eso esta prueba usa la pantalla como una persona en el paso crítico (sin consola), y solo usa consola para la preparación rápida (dar de alta la empresa y el dueño), igual que en rondas anteriores.

## Antes de empezar

- Usa SOLO la vista previa `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca producción, sin «deploy-preview»).
- Si el navegador ya se usó antes para otra prueba de QA, borra los datos del sitio: cookies, almacenamiento local y de sesión, bases IndexedDB, **caché y service workers** (no basta con borrar solo cookies), y recarga con Ctrl+Shift+R. Si el problema sigue después de borrar, pide una vista previa nueva en vez de repetir el borrado sobre la misma dirección.

## Texto para pegar en Cowork

> Eres Cowork. Haz esta prueba SOLO en la vista previa de QA `https://deploy-preview-118--chic-entremet-9107cf.netlify.app` (nunca en producción). Es una prueba con una cuenta ficticia nueva. Para en la primera diferencia y cuéntamela con el texto exacto que veas en pantalla; no intentes arreglar nada.
>
> **Paso 1 — preparación (con consola):**
> 1. Abre la vista previa e inicia sesión como `owner.a@qa.invalid` (la cuenta de QA «QA Propietario A», con su contraseña de pruebas). Espera a que cargue el panel.
> 2. Abre la consola del navegador (F12 → Console), pega el bloque de código de abajo y pulsa Intro. Imprime al final una línea `DATOS_DUENA_NUEVA` con un correo y una contraseña — **apunta esos dos datos exactos**, los necesitas en el paso siguiente.
> 3. Cierra la consola. Cierra la sesión del administrador (botón «Cerrar sesión»).
>
> **Paso 2 — la pantalla, como una persona (sin consola):**
> 4. 📷 En la pantalla de inicio de sesión, entra con el correo y la contraseña que apuntaste en el paso 2.
> 5. 📷 Debe aparecer una pantalla titulada **«Elige tu contraseña»**, con dos campos (nueva contraseña y repetirla) y un botón «Guardar contraseña y entrar». Dime exactamente qué ves — si en vez de eso entra directamente al programa, **para ahí y avísame**, es la señal de alarma de esta prueba.
> 6. 📷 Escribe una contraseña nueva (por ejemplo `ClaveDefinitivaPantalla2026`) en los dos campos y pulsa «Guardar contraseña y entrar».
> 7. 📷 La página debería recargarse sola y entrar normalmente al programa, sin volver a pedir la contraseña. Dime qué ves.
> 8. Cierra esa sesión. Vuelve a entrar con el MISMO correo pero la contraseña NUEVA que acabas de poner (la del paso 6). Debe entrar directo, sin la pantalla de «Elige tu contraseña». 📷
>
> **Paso 3 — que una cuenta ya resuelta no vuelva a pedirla (regresión, sin consola):**
> 9. Cierra esa sesión. Entra con `duena.password.mvb643d3@qa.invalid`, contraseña `ClaveDefinitivaPrueba2026` (cuenta de la ronda anterior de hoy, que ya cambió su contraseña). Debe entrar directo al programa, sin la pantalla de «Elige tu contraseña». 📷
>
> Cuéntame el resultado de cada paso marcado con 📷 (con capturas si puedes) y cualquier error que veas en pantalla.

```js
(async () => {
  const sb = await window.getSupabaseClient();
  const url = sb.supabaseUrl, key = sb.supabaseKey;
  const tokAdmin = (await sb.auth.getSession()).data.session.access_token;
  const llamar = async (tok, cuerpo) => {
    const r = await fetch(url + '/functions/v1/plataforma-crear-propietario', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, apikey: key }, body: JSON.stringify(cuerpo) });
    return { http: r.status, cuerpo: await r.json().catch(() => null) };
  };
  const id = Date.now().toString(36);
  const email = 'duena.pantalla.' + id + '@qa.invalid';
  const password = 'ClaveInicialPantalla2026';

  const alta = await sb.rpc('plataforma_crear_empresa', { p_operation_id: 'qa-pantalla-alta-' + id, p_nombre: 'QA Cliente Prueba Pantalla ' + id, p_local_nombre: 'Local QA Pantalla', p_cif: null, p_propietario_user_id: null });
  if (!alta.data || !alta.data.empresa_id) { console.log('FALLO_ALTA', JSON.stringify(alta)); return; }

  const creado = await llamar(tokAdmin, { empresaId: alta.data.empresa_id, nombre: 'Dueña Prueba Pantalla', email, password });
  if (creado.http !== 200) { console.log('FALLO_CREAR_DUENO', JSON.stringify(creado)); return; }

  console.log('DATOS_DUENA_NUEVA', JSON.stringify({ correo: email, contrasena_inicial: password }, null, 1));
})();
```

## Resultado esperado (para comparar)
| Paso | Esperado |
|---|---|
| 2 | imprime `DATOS_DUENA_NUEVA` con correo y contraseña |
| 4 | inicia sesión sin error |
| 5 | **aparece** «Elige tu contraseña» |
| 6 | el formulario acepta la contraseña nueva, sin errores |
| 7 | la página se recarga y entra directo al programa (ya no pide la contraseña) |
| 8 | entra directo con la contraseña nueva, sin la pantalla |
| 9 | entra directo, sin la pantalla (cuenta de la ronda anterior) |

**Diferencia clave a vigilar:** si en el paso 5 entra directo al programa SIN la pantalla «Elige tu contraseña», la pantalla no está preguntando al servidor correctamente (o está cayendo al criterio antiguo sin motivo) — es la señal de alarma más importante de esta prueba.

## Qué queda en QA después
- Una empresa «QA Cliente Prueba Pantalla …» con su local y la cuenta del dueño `duena.pantalla.….@qa.invalid`, con su contraseña ya cambiada a la del paso 6. Ficticia, no comparte nada con las cuentas compartidas.
- **No se borra nada a mano:** se deja para la fase de borrado definitivo, igual que el resto de empresas de prueba.

## Nota sobre la vista previa
Esta vista previa (`deploy-preview-118`) se generó HOY, a partir de la rama `claude/d01-decisiones-20261016` sustituyendo el contenido de `claude/vigilant-hawking-uji8l4` (PR #118, que no se fusiona nunca): ese PR ahora refleja exactamente `release` + el trabajo de D01 de hoy, no su historial antiguo. El PR sigue marcado «NO FUSIONAR» y sin cambios para producción.

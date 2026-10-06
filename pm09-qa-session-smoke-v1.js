(() => {
  const QA_PREVIEW_HOST = 'deploy-preview-126--chic-entremet-9107cf.netlify.app';
  const PASS = 'PM09_QA_SMOKE_PASS_ROLLBACK';
  if (location.hostname !== QA_PREVIEW_HOST) return;

  const panel = document.createElement('aside');
  panel.setAttribute('aria-label', 'Diagnóstico PM09 de QA');
  panel.style.cssText = 'position:fixed;right:12px;bottom:68px;z-index:10000;max-width:320px;padding:12px;border:1px solid #b9c8be;border-radius:10px;background:#fff;color:#173d2a;box-shadow:0 4px 24px #0004;font:13px system-ui';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Ejecutar prueba PM09 de QA';
  button.style.cssText = 'padding:8px 10px;border:0;border-radius:6px;background:#173d2a;color:#fff;font-weight:600';

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.style.marginBottom = '0';
  status.textContent = 'Comprueba venta, fecha y reverso. El servidor deshace toda la transacción.';
  panel.append(button, status);
  document.body.append(panel);

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Verificando la sesión y ejecutando la prueba…';
    try {
      if (typeof window.getSupabaseClient !== 'function' || !window.__nubeActiva) {
        throw new Error('No hay conexión sincronizada.');
      }
      const client = await window.getSupabaseClient();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user?.id) throw new Error('No hay una sesión autenticada.');

      const { error } = await client.rpc('pm09_qa_session_smoke_20261006');
      if (!error?.message?.includes(PASS)) {
        throw new Error(error?.message || 'El servidor no devolvió el resultado esperado.');
      }
      status.textContent = 'PASS: venta, fecha y reverso correctos; transacción anulada sin residuos.';
    } catch (error) {
      status.textContent = `FALLO: ${error?.message || String(error)}`;
      button.disabled = false;
    }
  });
})();

import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.env.PREVIEW_URL || 'https://deploy-preview-10--chic-entremet-9107cf.netlify.app/';
const out = [];
const log = (...x) => { const s = x.join(' '); console.log(s); out.push(s); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'es-ES' });
const page = await context.newPage();
page.on('console', msg => { if (msg.type() === 'error') log('[console.error]', msg.text()); });
page.on('pageerror', err => log('[pageerror]', err.message));

async function visibleTexts(selector, limit = 30) {
  const loc = page.locator(selector);
  const n = await loc.count();
  const arr = [];
  for (let i = 0; i < Math.min(n, limit); i++) {
    const el = loc.nth(i);
    if (await el.isVisible().catch(() => false)) {
      const t = (await el.innerText().catch(() => '')).replace(/\s+/g,' ').trim();
      if (t) arr.push(t);
    }
  }
  return arr;
}

async function enterApp() {
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'audit=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  const localCandidates = page.getByText(/Trabajar solo en este equipo|sin sincronizar|solo en este equipo/i);
  const count = await localCandidates.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const el = localCandidates.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.click({ force: true }).catch(() => {});
      await sleep(2200);
      break;
    }
  }
  // Si ya está dentro pero en otro módulo, intentar volver al panel mediante navegación original.
  const dashboard = page.getByText(/Resumen general|Panel general/i).first();
  if (!(await dashboard.isVisible().catch(() => false))) {
    const candidates = page.locator('button,a,[role="button"]');
    const n = await candidates.count();
    for (const label of ['Hoy','Inicio','Panel general']) {
      for (let i = 0; i < n; i++) {
        const b = candidates.nth(i);
        if (!(await b.isVisible().catch(() => false))) continue;
        const t = (await b.innerText().catch(()=>'')).replace(/\s+/g,' ').trim();
        if (t === label || t.startsWith(label)) {
          await b.click({ force: true }).catch(()=>{});
          await sleep(1000);
          if (await dashboard.isVisible().catch(() => false)) break;
        }
      }
      if (await dashboard.isVisible().catch(() => false)) break;
    }
  }
  return await dashboard.isVisible().catch(() => false);
}

async function snapshot(tag) {
  const heads = await visibleTexts('h1,h2,h3', 20);
  const btns = await visibleTexts('button,a,[role="button"]', 60);
  log(`\n=== ${tag} ===`);
  log('HEADINGS:', JSON.stringify(heads));
  log('BUTTONS:', JSON.stringify(btns));
}

async function testQuick(label) {
  const okDash = await enterApp();
  const sel = page.locator('.la-quick-action').filter({ hasText: label }).first();
  const exists = await sel.isVisible().catch(() => false);
  if (!exists) { log(`[FAIL] Acción rápida ${label}: no existe/visible. Dashboard=${okDash}`); return; }
  const before = await page.locator('body').innerText();
  await sel.click({ force: true });
  await sleep(1300);
  const after = await page.locator('body').innerText();
  const dashStill = await page.getByText(/Resumen general|Panel general/i).first().isVisible().catch(() => false);
  const heads = await visibleTexts('h1,h2,h3', 12);
  const toast = await page.locator('.la-nav-toast.show').innerText().catch(() => '');
  log(`[${toast ? 'FAIL' : (before !== after ? 'OK' : 'WARN')}] Acción rápida ${label}: dashStill=${dashStill}; changed=${before!==after}; headings=${JSON.stringify(heads)}${toast ? '; toast='+toast : ''}`);
}

async function testKpis() {
  await enterApp();
  const cards = page.locator('.la-kpi-card');
  const n = await cards.count();
  log(`KPI cards visibles: ${n}`);
  for (let i = 0; i < n; i++) {
    await enterApp();
    const current = page.locator('.la-kpi-card').nth(i);
    if (!(await current.isVisible().catch(() => false))) continue;
    const label = (await current.innerText().catch(()=>'')).replace(/\s+/g,' ').trim().slice(0,90);
    const before = await page.locator('body').innerText();
    await current.click({ force:true }).catch(() => {});
    await sleep(700);
    const after = await page.locator('body').innerText();
    log(`[${before!==after?'OK':'WARN'}] KPI ${i+1}: ${JSON.stringify(label)}; DOM changed=${before!==after}`);
  }
}

async function testAlerts() {
  await enterApp();
  const alerts = page.locator('.la-alert-row');
  const n = await alerts.count();
  log(`Alertas premium visibles: ${n}`);
  for (let i = 0; i < n; i++) {
    await enterApp();
    const a = page.locator('.la-alert-row').nth(i);
    if (!(await a.isVisible().catch(() => false))) continue;
    const label = (await a.innerText().catch(()=>'')).replace(/\s+/g,' ').trim().slice(0,120);
    await a.click({ force:true }).catch(()=>{});
    await sleep(1100);
    const toast = await page.locator('.la-nav-toast.show').innerText().catch(()=>'');
    const heads = await visibleTexts('h1,h2,h3',12);
    log(`[${toast?'FAIL':'OK'}] Alerta ${i+1}: ${JSON.stringify(label)}; headings=${JSON.stringify(heads)}${toast?'; toast='+toast:''}`);
  }
}

async function testReport() {
  await enterApp();
  const b = page.locator('.la-report-cta').first();
  if (!(await b.isVisible().catch(()=>false))) { log('[FAIL] Ver informe completo no visible'); return; }
  await b.click({force:true}); await sleep(1200);
  const toast = await page.locator('.la-nav-toast.show').innerText().catch(()=> '');
  const heads = await visibleTexts('h1,h2,h3',12);
  log(`[${toast?'FAIL':'OK'}] Ver informe completo: headings=${JSON.stringify(heads)}${toast?'; toast='+toast:''}`);
}

async function testTopControls() {
  await enterApp();
  const labels = ['Depart.','Ciclos','Rápido','Claro','Oscuro','Modo empleado'];
  const controls = page.locator('button,a,[role="button"]');
  for (const label of labels) {
    let target = null;
    const n = await controls.count();
    for (let i=0;i<n;i++) {
      const el=controls.nth(i); if (!(await el.isVisible().catch(()=>false))) continue;
      const t=(await el.innerText().catch(()=>'')).replace(/\s+/g,' ').trim();
      if (t.includes(label)) { target=el; break; }
    }
    if (!target) continue;
    const before=await page.locator('body').innerText();
    await target.click({force:true}).catch(()=>{}); await sleep(600);
    const after=await page.locator('body').innerText();
    log(`[${before!==after?'OK':'WARN'}] Control superior ${label}: DOM changed=${before!==after}`);
    // cerrar modal de modo empleado sin confirmar nada
    if (label === 'Modo empleado') {
      const close = page.getByText(/Cancelar|Cerrar/i).first();
      if (await close.isVisible().catch(()=>false)) await close.click({force:true}).catch(()=>{});
      else await page.keyboard.press('Escape').catch(()=>{});
    }
  }
}

const entered = await enterApp();
log('URL:', page.url());
log('Entró al dashboard:', entered);
await snapshot('ESTADO INICIAL');
for (const label of ['Ventas','Caja','Productos','Inventario','Compras','Informes']) await testQuick(label);
await testKpis();
await testAlerts();
await testReport();
await testTopControls();
await enterApp();
await page.screenshot({ path: 'dashboard-audit.png', fullPage: true });
fs.writeFileSync('dashboard-audit.txt', out.join('\n'));
await browser.close();

const failCount = out.filter(x => x.includes('[FAIL]')).length;
log('Fallos detectados:', failCount);
process.exitCode = failCount ? 2 : 0;

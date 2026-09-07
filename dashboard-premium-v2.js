(function(){
'use strict';
if(window.__laDashboardV2)return;window.__laDashboardV2=true;
const MASTER='./la-suite-logo.svg';
const ICON='./la-suite-icon.svg';
const css=`
.la-dashboard-v2{position:relative}
.la-dashboard-v2 .la-kpi-grid{display:grid!important;gap:12px!important}
.la-dashboard-v2 .la-kpi-card{position:relative!important;background:linear-gradient(145deg,#0D351F 0%,#0A2B1A 100%)!important;border:1px solid rgba(201,154,75,.28)!important;border-radius:18px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 24px rgba(0,0,0,.10)!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important}
.la-dashboard-v2 .la-kpi-card:active{transform:scale(.985)}
.la-dashboard-v2 .la-kpi-card .mono{color:#E0B35D!important}
.la-dashboard-v2 .la-kpi-card[data-la-alert='critical'] .mono{color:#EF7467!important}
.la-premium-section-title{font-size:15px;font-weight:700;margin:22px 0 10px;color:#F5EAD4;letter-spacing:-.01em}
.la-quick-actions{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:20px}
.la-quick-action{border:1px solid rgba(201,154,75,.24);background:linear-gradient(145deg,#0D351F,#092819);border-radius:14px;min-height:74px;padding:9px 4px;color:#E9DDBF;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:600;text-align:center;cursor:pointer}
.la-quick-action .la-qa-icon{font-size:21px;line-height:1;color:#D9A84F}
.la-quick-action[data-la-unavailable='1']{display:none!important}
.la-premium-alerts{display:grid;gap:8px;margin-bottom:14px}
.la-alert-row{width:100%;display:flex;align-items:center;gap:10px;padding:12px 13px;border-radius:14px;background:linear-gradient(145deg,#0D351F,#092819);border:1px solid rgba(201,154,75,.22);text-align:left;color:#F1E8D5;cursor:pointer}
.la-alert-row.la-info{cursor:default}
.la-alert-row .la-alert-icon{width:31px;height:31px;flex:0 0 31px;border-radius:50%;display:grid;place-items:center;background:rgba(201,154,75,.12);color:#DFAE52;font-size:16px}
.la-alert-row.critical{border-color:rgba(232,91,79,.35)}
.la-alert-row.critical .la-alert-icon{background:rgba(232,91,79,.13);color:#EE6D61}
.la-alert-copy{min-width:0;flex:1}.la-alert-copy b{display:block;font-size:12.5px;margin-bottom:1px}.la-alert-copy span{display:block;font-size:10.5px;color:#99AB9F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.la-alert-chevron{color:#DFAE52;font-size:22px}
.la-report-cta{width:100%;border:0;border-radius:15px;background:linear-gradient(100deg,#A8742F,#E3B75F,#BE8A3C);color:#102A1B;font-size:13px;font-weight:800;padding:14px 16px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 8px 22px rgba(169,116,47,.18);margin:12px 0 22px;cursor:pointer}
.la-dashboard-v2 .la-dashboard-brand{object-fit:contain!important;filter:drop-shadow(0 5px 10px rgba(0,0,0,.22))}
.la-brand-master{object-fit:contain!important;filter:drop-shadow(0 6px 12px rgba(0,0,0,.24))}
.la-nav-toast{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:10050;background:#102F20;color:#F5EAD4;border:1px solid rgba(201,154,75,.5);border-radius:13px;padding:10px 14px;font:600 12px/1.25 'IBM Plex Sans',sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.28);max-width:min(88vw,380px);text-align:center;opacity:0;transition:opacity .18s ease;pointer-events:none}.la-nav-toast.show{opacity:1}
@media(max-width:767px){
  .la-dashboard-v2 .la-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .la-dashboard-v2 .la-kpi-card{padding:14px!important;min-height:126px!important}
  .la-dashboard-v2 .la-kpi-card:nth-child(n+3){min-height:104px!important}
  .la-dashboard-v2 .la-kpi-card .mono{font-size:26px!important;line-height:1.05!important}
  .la-dashboard-v2 .la-dashboard-brand{width:96px!important;height:78px!important;border-radius:0!important;background:transparent!important}
  .la-dashboard-v2 h2{font-size:27px!important;line-height:1.08!important;letter-spacing:-.035em!important}
  .la-quick-actions{grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}
  .la-quick-action{min-height:67px;padding:7px 2px;border-radius:12px;font-size:9px}
  .la-quick-action .la-qa-icon{font-size:19px}
  .la-premium-alerts{grid-template-columns:1fr}
  #cargando .logo-suite{width:min(72vw,330px)!important}
}
@media(min-width:768px){
  .la-dashboard-v2 .la-kpi-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}
  .la-dashboard-v2 .la-kpi-card{min-height:128px!important}
  .la-dashboard-v2 .la-dashboard-brand{width:132px!important;height:102px!important}
  .la-premium-alerts{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;
const style=document.createElement('style');style.id='la-dashboard-v2-style';style.textContent=css;document.head.appendChild(style);

function norm(v){return String(v||'').trim().replace(/\s+/g,' ').toLowerCase()}
function textEq(el,t){return norm(el&&el.textContent)===norm(t)}
function all(sel,scope=document){return Array.from((scope||document).querySelectorAll(sel))}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function isVisible(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.pointerEvents!=='none'&&el.getClientRects().length>0}
function isInjected(el){return !!(el&&el.closest&&el.closest('.la-quick-actions,.la-premium-alerts,.la-report-cta,.la-dashboard-extra,[data-la-injected="1"],.la-nav-toast'))}
function originalControls(){return all('button,a,[role="button"]').filter(el=>isVisible(el)&&!isInjected(el))}
function findOriginal(labels){
  const controls=originalControls();
  for(const raw of labels){const label=norm(raw);const exact=controls.filter(el=>norm(el.textContent)===label);if(exact.length)return exact[0]}
  for(const raw of labels){const label=norm(raw);const starts=controls.filter(el=>norm(el.textContent).startsWith(label));if(starts.length===1)return starts[0]}
  return null;
}
async function clickOriginal(labels,tries=4,gap=180){
  for(let i=0;i<tries;i++){const n=findOriginal(labels);if(n){n.click();await wait(gap);return true}await wait(gap)}
  return false;
}
function contentRoot(){return document.querySelector('main')||findDashboard()?.root||document.body}
function contentHas(labels){const txt=norm(contentRoot()?.innerText||contentRoot()?.textContent||'');return labels.some(x=>txt.includes(norm(x)))}
function toast(msg){let t=document.querySelector('.la-nav-toast');if(!t){t=document.createElement('div');t.className='la-nav-toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t.__timer);t.__timer=setTimeout(()=>t.classList.remove('show'),1900)}

const ROUTES={
  inicio:{targets:['Hoy','Inicio'],sections:[],expected:['Panel general','Resumen general']},
  ventas:{targets:['TPV'],sections:['Hoy','Inicio','Más'],expected:['Historial de ventas','TPV','Selecciona un local','local concreto']},
  caja:{targets:['Arqueo de caja'],sections:['Más'],expected:['Arqueo de caja']},
  productos:{targets:['Productos'],sections:['Almacén'],expected:['Productos']},
  inventario:{targets:['Inventario ciego'],sections:['Almacén'],expected:['Inventario ciego']},
  compras:{targets:['Pedidos'],sections:['Comprar'],expected:['Pedidos de compra']},
  informes:{targets:['Resultados'],sections:['Más'],expected:['Resultados']},
  pagos:{targets:['Cuentas por pagar'],sections:['Comprar'],expected:['Cuentas por pagar']},
  saldo:{targets:['Saldo de almacén'],sections:['Almacén'],expected:['Saldo de almacén']},
  encargos:{targets:['Encargos'],sections:['Hoy','Más'],expected:['Encargos']},
  traspasos:{targets:['Traspasos'],sections:['Almacén'],expected:['Traspasos']}
};
function routeAvailable(key){const r=ROUTES[key];return !!(r&&findOriginal(r.targets))}
async function verifyRoute(r){for(let i=0;i<5;i++){await wait(100);if(contentHas(r.expected))return true}return false}
async function goToModule(name){
  const key=norm(name);const r=ROUTES[key];if(!r){toast('Ese acceso todavía no tiene un destino definido.');return false}
  let clicked=false;
  if(await clickOriginal(r.targets,2,130)){clicked=true;if(await verifyRoute(r))return true}
  for(const section of r.sections){
    if(await clickOriginal([section],2,140)){
      await wait(180);
      if(await clickOriginal(r.targets,4,150)){clicked=true;if(await verifyRoute(r))return true}
    }
  }
  if(clicked)toast('El acceso respondió, pero no pude confirmar la pantalla de '+name+'.');
  else toast('No pude abrir '+name+' desde esta vista.');
  return false;
}
window.__laGoToModule=goToModule;

function nearestCardFromText(label,scope){
  const base=scope||document;
  const nodes=all('div,span',base).filter(el=>textEq(el,label));
  for(const node of nodes){
    let p=node;
    for(let i=0;i<7&&p;i++,p=p.parentElement){
      if(p.tagName==='BUTTON'&&!isInjected(p)&&(!scope||scope.contains(p)))return p;
      if(scope&&p===scope)break;
    }
    const b=node.closest('button');if(b&&!isInjected(b)&&(!scope||scope.contains(b)))return b;
  }
  return null;
}
function loginRoot(){
  const marker=all('div,p').find(el=>norm(el.textContent)==='inicia sesión para sincronizar entre dispositivos');
  if(!marker)return null;
  let p=marker;for(let i=0;i<7&&p;i++,p=p.parentElement){if(p.querySelector&&p.querySelector('input[type="password"]'))return p}
  return marker.parentElement;
}
function replaceBrand(){
  const loading=document.querySelector('#cargando .logo-suite');if(loading){loading.src=MASTER;loading.classList.add('la-brand-master')}
  const lr=loginRoot();if(lr){all('h1,h2,h3,strong,b,div,span',lr).forEach(el=>{if(el.children.length===0&&norm(el.textContent)==='chocoloyos')el.textContent='L&A Suite'});const img=lr.querySelector('img');if(img){img.src=MASTER;img.alt='L&A Suite';img.classList.add('la-brand-master');img.style.width='min(72vw,300px)';img.style.height='auto'}}
  all('aside img').forEach((img,i)=>{if(i===0){img.src=MASTER;img.alt='L&A Suite';img.classList.add('la-brand-master');img.style.maxHeight='150px'}});
  all('img').forEach(img=>{const alt=norm(img.getAttribute('alt'));const src=norm(img.getAttribute('src'));if(alt.includes('l&a suite')||src.includes('la-suite-logo')||src.includes('la-suite-icon')){const small=(img.width&&img.width<=48)||(img.style.width&&parseInt(img.style.width,10)<=48);img.src=small?ICON:MASTER;img.classList.add('la-brand-master')}});
}
function findDashboard(){
  const heading=all('h1,h2,h3,div').find(el=>['panel general','resumen general'].includes(norm(el.textContent))&&el.children.length===0);
  if(!heading)return null;
  let p=heading;for(let i=0;i<7&&p;i++,p=p.parentElement){const txt=norm(p.textContent);if(txt.includes('margen promedio')&&txt.includes('pedidos pendientes')&&txt.includes('productos en stock bajo'))return {root:p,heading}}
  return null;
}
const kpis=[['Saldo de almacén','saldo'],['Margen promedio','margen'],['Pedidos pendientes','pedidos'],['Productos en stock bajo','stock'],['Lotes que caducan (30 d)','lotes'],['Facturas por pagar (7 d)','facturas'],['Encargos urgentes','encargos'],['Reponer piso de venta','reponer']];
function syncQuickAvailability(wrap){
  if(!wrap)return;
  const defs={ventas:'ventas',caja:'caja',productos:'productos',inventario:'inventario',compras:'compras',informes:'informes'};
  all('.la-quick-action',wrap).forEach(b=>{const target=defs[norm(b.dataset.laTarget)];if(!target)return;b.dataset.laUnavailable=routeAvailable(target)?'0':'1'});
}
function addQuickActions(root,grid){
  let wrap=root.querySelector('.la-quick-actions');
  if(!wrap){
    const title=document.createElement('div');title.className='la-premium-section-title';title.dataset.laInjected='1';title.textContent='Acciones rápidas';
    wrap=document.createElement('div');wrap.className='la-quick-actions';wrap.dataset.laInjected='1';
    const defs=[['↗','Ventas','ventas'],['▣','Caja','caja'],['◇','Productos','productos'],['▤','Inventario','inventario'],['🛒','Compras','compras'],['▥','Informes','informes']];
    defs.forEach(([ico,label,target])=>{const b=document.createElement('button');b.type='button';b.className='la-quick-action';b.dataset.laInjected='1';b.dataset.laTarget=target;b.innerHTML=`<span class="la-qa-icon">${ico}</span><span>${label}</span>`;b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();goToModule(target)});wrap.appendChild(b)});
    grid.insertAdjacentElement('afterend',title);title.insertAdjacentElement('afterend',wrap);
  }
  syncQuickAvailability(wrap);
}
function metricInfo(label,root){const b=nearestCardFromText(label,root);if(!b)return null;const mono=b.querySelector('.mono');return {button:b,value:(mono?mono.textContent:'').trim()}}
function numberOf(v){const m=String(v||'').replace(/\./g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):0}
function clickKpi(info){if(info&&info.button&&info.button.isConnected){info.button.click();return true}return false}
function addAlerts(root){
  let title=root.querySelector('.la-alerts-title'),wrap=root.querySelector('.la-premium-alerts');
  if(!title){title=document.createElement('div');title.className='la-premium-section-title la-alerts-title';title.dataset.laInjected='1';title.textContent='Alertas importantes'}
  if(!wrap){wrap=document.createElement('div');wrap.className='la-premium-alerts';wrap.dataset.laInjected='1'}
  const stock=metricInfo('Productos en stock bajo',root),ped=metricInfo('Pedidos pendientes',root),lot=metricInfo('Lotes que caducan (30 d)',root),fac=metricInfo('Facturas por pagar (7 d)',root);
  const defs=[];
  if(stock&&numberOf(stock.value)>0)defs.push({kind:'critical',ico:'●',ttl:`${stock.value} productos en stock bajo`,sub:'Revisa y repón para evitar quiebres.',action:()=>clickKpi(stock)});
  if(ped&&numberOf(ped.value)>0)defs.push({kind:'warn',ico:'△',ttl:`${ped.value} pedidos pendientes`,sub:'Hay pedidos pendientes de procesar.',action:()=>clickKpi(ped)});
  if(lot&&numberOf(lot.value)>0)defs.push({kind:'warn',ico:'◷',ttl:`${lot.value} lotes por revisar`,sub:'Revisa las caducidades próximas.',action:()=>clickKpi(lot)});
  else if(lot)defs.push({kind:'info',ico:'✓',ttl:'No hay lotes por caducar en 30 días',sub:'Todo bajo control.',action:null});
  if(fac&&numberOf(fac.value)>0)defs.push({kind:'warn',ico:'▤',ttl:`${fac.value} facturas próximas`,sub:'Revisa los próximos vencimientos.',action:()=>clickKpi(fac)});
  const signature=defs.map(d=>[d.kind,d.ico,d.ttl,d.sub].join('|')).join('||');
  if(wrap.dataset.laSignature!==signature){
    wrap.dataset.laSignature=signature;wrap.innerHTML='';
    defs.slice(0,4).forEach(d=>{
      const el=document.createElement(d.action?'button':'div');if(d.action)el.type='button';
      el.className='la-alert-row '+(d.kind==='critical'?'critical ':d.kind==='info'?'la-info ':'');el.dataset.laInjected='1';
      el.innerHTML=`<span class="la-alert-icon">${d.ico}</span><span class="la-alert-copy"><b>${d.ttl}</b><span>${d.sub}</span></span>${d.action?'<span class="la-alert-chevron">›</span>':''}`;
      if(d.action)el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();d.action()});
      wrap.appendChild(el);
    });
  }
  const qa=root.querySelector('.la-quick-actions');if(qa){if(title.parentElement!==root||title.previousElementSibling!==qa)qa.insertAdjacentElement('afterend',title);if(wrap.previousElementSibling!==title)title.insertAdjacentElement('afterend',wrap)}
  if(!root.querySelector('.la-report-cta')){const cta=document.createElement('button');cta.type='button';cta.className='la-report-cta';cta.dataset.laInjected='1';cta.innerHTML='<span>▥</span><span>Ver informe completo</span><span>›</span>';cta.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();goToModule('informes')});wrap.insertAdjacentElement('afterend',cta)}
}
function hideOldMobileBlocks(root){if(window.innerWidth>767)return;['Alertas de reposición','Caducidades próximas','Movimiento reciente de almacén'].forEach(label=>{const n=all('div',root).find(el=>textEq(el,label));if(n){let p=n;for(let i=0;i<4&&p;i++,p=p.parentElement){if(p.parentElement===root||(p.className&&String(p.className).includes('rounded'))){p.dataset.laOldBlock='1';break}}}});root.querySelectorAll('[data-la-old-block="1"]').forEach(el=>el.style.display='none')}
function enhanceDashboard(){
  const d=findDashboard();if(!d)return;const {root,heading}=d;root.classList.add('la-dashboard-v2');if(norm(heading.textContent)!=='resumen general')heading.textContent='Resumen general';let first=null;
  kpis.forEach(([label,id])=>{const b=nearestCardFromText(label,root);if(b){b.classList.add('la-kpi-card');b.dataset.laKpi=id;if(id==='stock'){const m=b.querySelector('.mono');if(m&&numberOf(m.textContent)>0)b.dataset.laAlert='critical';else delete b.dataset.laAlert}if(!first)first=b}});
  if(first&&first.parentElement){const grid=first.parentElement;grid.classList.add('la-kpi-grid');addQuickActions(root,grid);addAlerts(root)}
  const headerImg=heading.parentElement&&heading.parentElement.parentElement&&heading.parentElement.parentElement.querySelector('img');if(headerImg){headerImg.src=MASTER;headerImg.alt='L&A Suite';headerImg.classList.add('la-dashboard-brand')}
  hideOldMobileBlocks(root);
}
let scheduled=false;function refresh(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;replaceBrand();enhanceDashboard()})}
const mo=new MutationObserver(muts=>{if(muts.some(m=>Array.from(m.addedNodes||[]).some(n=>!(n.nodeType===1&&n.closest&&n.closest('[data-la-injected="1"]')))))refresh()});
mo.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('resize',refresh);window.addEventListener('load',refresh);refresh();
})();

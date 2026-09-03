(function(){
'use strict';
if(window.__laDashboardV2)return;window.__laDashboardV2=true;
const MASTER='./la-suite-logo.svg';
const ICON='./la-suite-icon.svg';
const GOLD='#C99A4B';
const css=`
.la-dashboard-v2{position:relative}
.la-dashboard-v2 .la-kpi-grid{display:grid!important;gap:12px!important}
.la-dashboard-v2 .la-kpi-card{position:relative!important;background:linear-gradient(145deg,#0D351F 0%,#0A2B1A 100%)!important;border:1px solid rgba(201,154,75,.28)!important;border-radius:18px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 24px rgba(0,0,0,.10)!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important}
.la-dashboard-v2 .la-kpi-card:active{transform:scale(.985)}
.la-dashboard-v2 .la-kpi-card .mono{color:#E0B35D!important}
.la-dashboard-v2 .la-kpi-card[data-la-alert='critical'] .mono{color:#EF7467!important}
.la-premium-section-title{font-size:15px;font-weight:700;margin:22px 0 10px;color:#F5EAD4;letter-spacing:-.01em}
.la-quick-actions{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:20px}
.la-quick-action{border:1px solid rgba(201,154,75,.24);background:linear-gradient(145deg,#0D351F,#092819);border-radius:14px;min-height:74px;padding:9px 4px;color:#E9DDBF;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:600;text-align:center}
.la-quick-action .la-qa-icon{font-size:21px;line-height:1;color:#D9A84F}
.la-premium-alerts{display:grid;gap:8px;margin-bottom:14px}
.la-alert-row{width:100%;display:flex;align-items:center;gap:10px;padding:12px 13px;border-radius:14px;background:linear-gradient(145deg,#0D351F,#092819);border:1px solid rgba(201,154,75,.22);text-align:left;color:#F1E8D5}
.la-alert-row .la-alert-icon{width:31px;height:31px;flex:0 0 31px;border-radius:50%;display:grid;place-items:center;background:rgba(201,154,75,.12);color:#DFAE52;font-size:16px}
.la-alert-row.critical{border-color:rgba(232,91,79,.35)}
.la-alert-row.critical .la-alert-icon{background:rgba(232,91,79,.13);color:#EE6D61}
.la-alert-copy{min-width:0;flex:1}.la-alert-copy b{display:block;font-size:12.5px;margin-bottom:1px}.la-alert-copy span{display:block;font-size:10.5px;color:#99AB9F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.la-alert-chevron{color:#DFAE52;font-size:22px}
.la-report-cta{width:100%;border:0;border-radius:15px;background:linear-gradient(100deg,#A8742F,#E3B75F,#BE8A3C);color:#102A1B;font-size:13px;font-weight:800;padding:14px 16px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 8px 22px rgba(169,116,47,.18);margin:12px 0 22px}
.la-dashboard-v2 .la-dashboard-brand{object-fit:contain!important;filter:drop-shadow(0 5px 10px rgba(0,0,0,.22))}
.la-brand-master{object-fit:contain!important;filter:drop-shadow(0 6px 12px rgba(0,0,0,.24))}
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

function textEq(el,t){return (el&&el.textContent||'').trim().replace(/\s+/g,' ')===t}
function all(sel){return Array.from(document.querySelectorAll(sel))}
function nearestCardFromText(label){
  const node=all('div,span').find(el=>textEq(el,label));
  if(!node)return null;
  let p=node;
  for(let i=0;i<6&&p;i++,p=p.parentElement){if(p.tagName==='BUTTON')return p}
  return node.closest('button');
}
function clickExisting(labels){
  for(const label of labels){
    const candidates=all('button').filter(b=>!b.closest('.la-quick-actions')&&!b.closest('.la-premium-alerts'));
    const exact=candidates.find(b=>textEq(b,label));if(exact){exact.click();return true}
    const partial=candidates.find(b=>(b.textContent||'').trim().toLowerCase().startsWith(label.toLowerCase()));if(partial){partial.click();return true}
  }
  return false;
}
function loginRoot(){
  const marker=all('div,p').find(el=>(el.textContent||'').trim()==='Inicia sesión para sincronizar entre dispositivos');
  if(!marker)return null;
  let p=marker;for(let i=0;i<7&&p;i++,p=p.parentElement){if(p.querySelector&&p.querySelector('input[type="password"]'))return p}
  return marker.parentElement;
}
function replaceBrand(){
  const loading=document.querySelector('#cargando .logo-suite');if(loading){loading.src=MASTER;loading.classList.add('la-brand-master')}
  const lr=loginRoot();if(lr){
    const img=lr.querySelector('img');if(img){img.src=MASTER;img.alt='L&A Suite';img.classList.add('la-brand-master');img.style.width='min(72vw,300px)';img.style.height='auto'}
  }
  all('aside img').forEach((img,i)=>{if(i===0){img.src=MASTER;img.alt='L&A Suite';img.classList.add('la-brand-master');img.style.maxHeight='150px'}});
  all('img').forEach(img=>{
    const alt=(img.getAttribute('alt')||'').toLowerCase();const src=(img.getAttribute('src')||'').toLowerCase();
    if(alt.includes('l&a suite')||src.includes('la-suite-logo')||src.includes('la-suite-icon')){
      const small=(img.width&&img.width<=48)||(img.style.width&&parseInt(img.style.width,10)<=48);
      img.src=small?ICON:MASTER;img.classList.add('la-brand-master');
    }
  });
}
function findDashboard(){
  const heading=all('h1,h2,h3,div').find(el=>['Panel general','Resumen general'].includes((el.textContent||'').trim())&&el.children.length===0);
  if(!heading)return null;
  let p=heading;
  for(let i=0;i<7&&p;i++,p=p.parentElement){
    const txt=(p.textContent||'');
    if(txt.includes('Margen promedio')&&txt.includes('Pedidos pendientes')&&txt.includes('Productos en stock bajo'))return {root:p,heading};
  }
  return null;
}
const kpis=[
  ['Saldo de almacén','saldo'],['Margen promedio','margen'],['Pedidos pendientes','pedidos'],['Productos en stock bajo','stock'],
  ['Lotes que caducan (30 d)','lotes'],['Facturas por pagar (7 d)','facturas'],['Encargos urgentes','encargos'],['Reponer piso de venta','reponer']
];
function addQuickActions(root,grid){
  if(root.querySelector('.la-quick-actions'))return;
  const title=document.createElement('div');title.className='la-premium-section-title';title.textContent='Acciones rápidas';
  const wrap=document.createElement('div');wrap.className='la-quick-actions';
  const defs=[['📈','Ventas',['TPV','Ventas']],['▣','Caja',['Arqueo de caja','Caja']],['◇','Productos',['Productos']],['▤','Inventario',['Inventario ciego','Inventario']],['🛒','Compras',['Pedidos','Compras']],['▥','Informes',['Reportes y rotación','Resultados','Informes']]];
  defs.forEach(([ico,label,targets])=>{const b=document.createElement('button');b.className='la-quick-action';b.innerHTML=`<span class="la-qa-icon">${ico}</span><span>${label}</span>`;b.onclick=()=>clickExisting(targets);wrap.appendChild(b)});
  grid.insertAdjacentElement('afterend',title);title.insertAdjacentElement('afterend',wrap);
}
function metricInfo(label){
  const b=nearestCardFromText(label);if(!b)return null;
  const mono=b.querySelector('.mono');const val=(mono?mono.textContent:'').trim();return {button:b,value:val};
}
function addAlerts(root){
  let title=root.querySelector('.la-alerts-title');let wrap=root.querySelector('.la-premium-alerts');
  if(!title){title=document.createElement('div');title.className='la-premium-section-title la-alerts-title';title.textContent='Alertas importantes'}
  if(!wrap){wrap=document.createElement('div');wrap.className='la-premium-alerts'}
  wrap.innerHTML='';
  const stock=metricInfo('Productos en stock bajo'),ped=metricInfo('Pedidos pendientes'),lot=metricInfo('Lotes que caducan (30 d)'),fac=metricInfo('Facturas por pagar (7 d)');
  const defs=[];
  if(stock&&Number((stock.value||'').replace(',','.'))>0)defs.push(['critical','●',`${stock.value} productos en stock bajo`,'Revisa y repón para evitar quiebres.',stock.button]);
  if(ped&&Number((ped.value||'').replace(',','.'))>0)defs.push(['warn','△',`${ped.value} pedidos pendientes`,'Hay pedidos pendientes de procesar.',ped.button]);
  if(lot)defs.push(['ok','◷',Number((lot.value||'').replace(',','.'))>0?`${lot.value} lotes por revisar`:'No hay lotes por caducar en 30 días',Number((lot.value||'').replace(',','.'))>0?'Revisa las caducidades próximas.':'Todo bajo control.',lot.button]);
  if(fac&&Number((fac.value||'').replace(',','.'))>0)defs.push(['warn','▤',`${fac.value} facturas próximas`,'Revisa los próximos vencimientos.',fac.button]);
  defs.slice(0,4).forEach(([kind,ico,ttl,sub,target])=>{const b=document.createElement('button');b.className='la-alert-row '+(kind==='critical'?'critical':'');b.innerHTML=`<span class="la-alert-icon">${ico}</span><span class="la-alert-copy"><b>${ttl}</b><span>${sub}</span></span><span class="la-alert-chevron">›</span>`;b.onclick=()=>target&&target.click();wrap.appendChild(b)});
  const qa=root.querySelector('.la-quick-actions');if(qa){qa.insertAdjacentElement('afterend',title);title.insertAdjacentElement('afterend',wrap)}
  if(!root.querySelector('.la-report-cta')){const cta=document.createElement('button');cta.className='la-report-cta';cta.innerHTML='<span>▥</span><span>Ver informe completo</span><span>›</span>';cta.onclick=()=>clickExisting(['Resultados','Panel de dirección','Informes']);wrap.insertAdjacentElement('afterend',cta)}
}
function hideOldMobileBlocks(root){
  if(window.innerWidth>767)return;
  ['Alertas de reposición','Caducidades próximas','Movimiento reciente de almacén'].forEach(label=>{
    const n=all('div').find(el=>textEq(el,label));if(n){let p=n;for(let i=0;i<4&&p;i++,p=p.parentElement){if(p.parentElement===root||p.className&&String(p.className).includes('rounded')){p.dataset.laOldBlock='1';break}}}
  });
  root.querySelectorAll('[data-la-old-block="1"]').forEach(el=>el.style.display='none');
}
function enhanceDashboard(){
  const d=findDashboard();if(!d)return;
  const {root,heading}=d;root.classList.add('la-dashboard-v2');heading.textContent='Resumen general';
  let first=null;
  kpis.forEach(([label,id])=>{const b=nearestCardFromText(label);if(b&&root.contains(b)){b.classList.add('la-kpi-card');b.dataset.laKpi=id;if(id==='stock'){const m=b.querySelector('.mono');if(m&&Number((m.textContent||'').trim())>0)b.dataset.laAlert='critical'}if(!first)first=b}});
  if(first&&first.parentElement){const grid=first.parentElement;grid.classList.add('la-kpi-grid');addQuickActions(root,grid);addAlerts(root)}
  const headerImg=heading.parentElement&&heading.parentElement.parentElement&&heading.parentElement.parentElement.querySelector('img');if(headerImg){headerImg.src=MASTER;headerImg.alt='L&A Suite';headerImg.classList.add('la-dashboard-brand')}
  hideOldMobileBlocks(root);
}
let scheduled=false;function refresh(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;replaceBrand();enhanceDashboard()})}
const mo=new MutationObserver(refresh);mo.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('resize',refresh);window.addEventListener('load',refresh);refresh();
})();

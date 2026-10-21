import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('fuente.js','utf8');
const migration = fs.readFileSync('supabase/migrations/20260905105500_pm09_conciliacion_caja.sql','utf8');

function check(name, ok) {
  console.log(`PM09_P10_${name}=${ok ? 1 : 0}`);
  if (!ok) process.exitCode = 1;
}

check('HELPER_REVERSO_UNICO', (source.match(/function esReversoVentaCajaPM09\(/g)||[]).length === 1);
check('HELPER_RESUMEN_UNICO', (source.match(/function resumenMediosVentaCajaPM09\(/g)||[]).length === 1);
check('CAJA_SEPARA_VENTAS_Y_REVERSOS', source.includes('resumenVentasCaja.ventas.Efectivo') && source.includes('resumenVentasCaja.reversos.Efectivo'));
check('CAJA_DEVOLUCION_NO_DUPLICA', source.includes('DEVOLUCION_CLIENTE no entra aquí porque su reembolso'));
check('CAJA_SNAPSHOT_PM09', source.includes('pm09Caja: {') && source.includes('efectivoOtros') && source.includes('efectivoReversosCliente'));
check('CAJA_LOCAL_APLICA_REVERSO', source.includes('efectivoBase + ajustesVentaEfectivo + efectos'));
check('CAJA_ESPERADO_UI_CONCILIADO', source.includes('efectivoBase + ajustesVentaEfectivo + netoCaja'));
check('CAJA_UI_MUESTRA_TRES_COMPONENTES', source.includes('anulaciones venta €${fmt(ajustesVentaEfectivo)}'));

check('SQL_HELPER_SERVIDOR', migration.includes('private.pm09_resumen_caja_ventas'));
check('SQL_FECHA_UTC_EXPLICITA', migration.includes("timezone('UTC',m.created_at)::date=p_fecha"));
check('SQL_SOLO_VENTA_REVERSO', migration.includes("m.tipo in ('VENTA','REVERSO')"));
check('SQL_MIXTO_EFECTIVO', migration.includes("medio='MIXTO' then mixto_efectivo"));
check('SQL_MIXTO_TARJETA', migration.includes("medio='MIXTO' then mixto_tarjeta"));
check('SQL_PM09_RECALCULA_VENTAS', migration.includes('v_ventas_efectivo :=') && migration.includes('v_base := private.pm08_validar_dinero(v_ventas_efectivo+v_efectivo_otros'));
check('SQL_REVERSO_RESTA_ESPERADO', migration.includes('v_base+v_reversos_efectivo+v_efectos'));
check('SQL_COMPAT_PM08', migration.includes('Compatibilidad estricta con PM08'));
check('SQL_DEVOLUCION_NO_DUPLICA', migration.includes('sus reembolsos ya viven en caja_operaciones'));

// Modelo numérico del contrato de Caja.
function bruto(q, net, iva) { return Math.round((Math.abs(q)*Math.abs(net)*(1+iva/100)+Number.EPSILON)*100)/100; }
function resumenModelo(movs) {
  const ventas={Efectivo:0,Tarjeta:0,Transferencia:0,Otro:0};
  const reversos={Efectivo:0,Tarjeta:0,Transferencia:0,Otro:0};
  for (const m of movs) {
    if (!['VENTA','REVERSO'].includes(m.tipo)) continue;
    const dest=m.tipo==='VENTA'?ventas:reversos;
    const sign=m.tipo==='VENTA'?1:-1;
    if (m.medioPago==='Mixto') {
      dest.Efectivo += sign*(m.detallePago?.efectivo||0);
      dest.Tarjeta += sign*(m.detallePago?.tarjeta||0);
    } else {
      dest[m.medioPago] += sign*bruto(m.cantidad,m.ingresoUnitario,m.ivaVentaAplicado);
    }
  }
  return {ventas,reversos};
}
const movs=[
  {tipo:'VENTA',cantidad:2,ingresoUnitario:5.4545454545,ivaVentaAplicado:10,medioPago:'Efectivo'},
  {tipo:'REVERSO',cantidad:2,ingresoUnitario:-5.4545454545,ivaVentaAplicado:10,medioPago:'Efectivo'},
  {tipo:'VENTA',cantidad:1,ingresoUnitario:5.4545454545,ivaVentaAplicado:10,medioPago:'Tarjeta'},
  {tipo:'VENTA',cantidad:1,ingresoUnitario:5.4545454545,ivaVentaAplicado:10,medioPago:'Transferencia'},
  {tipo:'VENTA',cantidad:2,ingresoUnitario:5.4545454545,ivaVentaAplicado:10,medioPago:'Mixto',detallePago:{efectivo:5,tarjeta:7}},
  {tipo:'DEVOLUCION_CLIENTE',cantidad:1,ingresoUnitario:-5.4545454545,ivaVentaAplicado:10,medioPago:'Efectivo'}
];
const r=resumenModelo(movs);
check('MODELO_VENTAS_EFECTIVO_17', Math.abs(r.ventas.Efectivo-17)<1e-9);
check('MODELO_REVERSO_EFECTIVO_M12', Math.abs(r.reversos.Efectivo+12)<1e-9);
check('MODELO_TARJETA_13', Math.abs(r.ventas.Tarjeta-13)<1e-9);
check('MODELO_TRANSFERENCIA_6', Math.abs(r.ventas.Transferencia-6)<1e-9);
const efectivoOtros=0;
const efectosCaja=-3; // reembolso efectivo -4 + entrada 2 - retirada 1
const esperado=Math.round((r.ventas.Efectivo+efectivoOtros+r.reversos.Efectivo+efectosCaja+Number.EPSILON)*100)/100;
check('MODELO_ESPERADO_2', Math.abs(esperado-2)<1e-9);

// Ejecuta el componente real con hooks mínimos para comprobar la transición
// observable: al abrir Caja no se ofrece guardar con un saldo anterior.
const inicioArqueo=source.indexOf('function ArqueoCaja(');
const finArqueo=source.indexOf('\nvar PLANTILLAS_TURNO',inicioArqueo);
check('UI_ARQUEO_EXTRAIBLE', inicioArqueo>=0 && finArqueo>inicioArqueo);
if (inicioArqueo>=0 && finArqueo>inicioArqueo) {
  const codigoArqueo=source.slice(inicioArqueo,finArqueo);
  function crearVista(recargarCaja, sincronizado=true) {
    const estados=[];
    const efectos=[];
    let cursor=0;
    let primerRender=true;
    const react={
      default:{createElement:(type,props,...children)=>({type,props:props||{},children})},
      useState(inicial){
        const indice=cursor++;
        if (!(indice in estados)) estados[indice]=typeof inicial==='function'?inicial():inicial;
        return [estados[indice],valor=>{estados[indice]=typeof valor==='function'?valor(estados[indice]):valor;}];
      },
      useEffect(efecto){if(primerRender) efectos.push(efecto);}
    };
    const contexto={
      import_react4:react,
      todayISO:()=> '2026-10-05',
      modoSincronizadoPM08:()=>sincronizado,
      resumenMediosVentaCajaPM09:()=>({ventas:{Efectivo:0},reversos:{Efectivo:0},neto:{Efectivo:0},ventasIncluidas:0,reversosIncluidos:0}),
      redondearDineroPM08:valor=>Math.round(Number(valor)*100)/100,
      fmt:valor=>Number(valor).toFixed(2),
      C2:{inkSoft:'gray',accent:'green',bg:'white'},
      SectionTitle:'SectionTitle',Card:'Card',Btn:'Btn',Field:'Field',Input:'Input',Empty:'Empty',
      BloqueEntradasSalidas:'BloqueEntradasSalidas',Pill2:'Pill2',X2:'X2',CircleCheck:'CircleCheck',TriangleAlert:'TriangleAlert'
    };
    vm.runInNewContext(codigoArqueo+'\nthis.Componente=ArqueoCaja;',contexto);
    const props={recargarCaja,movimientosCaja:[{fecha:'2026-10-05',efectoEfectivo:1}],arqueos:[],movimientos:[],encargos:[]};
    return {
      render(){cursor=0;const arbol=contexto.Componente(props);primerRender=false;return arbol;},
      montar(){for(const efecto of efectos) efecto();}
    };
  }
  function texto(nodo){return typeof nodo==='string'?nodo:nodo&&typeof nodo==='object'?(nodo.children||[]).map(texto).join(' '):'';}
  const ok=crearVista(async()=>({ok:true}));
  const cargando=ok.render();
  check('UI_BLOQUEA_SALDO_CADUCADO',texto(cargando).includes('Actualizando los movimientos')&&!texto(cargando).includes('Guardar arqueo'));
  ok.montar();
  await new Promise(setImmediate);
  const actualizado=texto(ok.render());
  check('UI_MUESTRA_EFECTO_ABC_TRAS_LEER',actualizado.includes('ajustes/reembolsos caja €1.00')&&actualizado.includes('Guardar arqueo'));
  const fallo=crearVista(async()=>{throw new Error('lectura fallida');});
  fallo.render();
  fallo.montar();
  await new Promise(setImmediate);
  const bloqueado=texto(fallo.render());
  check('UI_FALLA_CERRADA_CON_REINTENTO',bloqueado.includes('Reintentar lectura')&&!bloqueado.includes('Guardar arqueo'));
}

if (process.exitCode) throw new Error('PM09_P10_CAJA_CONTRACT_FAIL');
console.log('PM09_P10_CAJA_CONTRACT_OK=1');

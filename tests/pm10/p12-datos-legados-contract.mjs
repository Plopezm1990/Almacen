import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('fuente.js','utf8');
function slice(a,b){const i=src.indexOf(a);const j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`falta bloque ${a}`);return src.slice(i,j);}
const ctx={todayISO:()=> '2026-09-05'};
vm.createContext(ctx);
vm.runInContext(slice('function errorValidacionPM10','function crearLogicaProductos'),ctx);
vm.runInContext(slice('function fechaValidaPedidoPM10','function crearLogicaPedidos'),ctx);
vm.runInContext(slice('function validarEmpleadoPM10','function crearLogicaPersonal'),ctx);
vm.runInContext(slice('function validarEncargoPM10','function crearLogicaEncargos'),ctx);
vm.runInContext(slice('function diagnosticarDatosLegadosPM10','function DiagnosticoDatosLegadosPM10'),ctx);

const diagnosticar=ctx.diagnosticarDatosLegadosPM10;
assert.equal(typeof diagnosticar,'function');

const empresas=[{id:'E1'}];
const locales=[{id:'L1',empresaId:'E1',activo:true},{id:'L2',empresaId:'E1',activo:true}];
const proveedores=[{id:'prov1',empresaId:'E1'}];
const clientes=[{id:'cli1',empresaId:'E1'}];
const productos=[{id:'p1',localId:'L1',nombre:'Producto limpio',costo:2,stockMinimo:0,udsPorCaja:1,ivaCompra:10,ivaVenta:10,stock:5}];
const pedidos=[{id:'ped1',localId:'L1',proveedorId:'prov1',fechaEsperada:'2026-09-20',estado:'Pendiente',items:[{productoId:'p1',cantidad:3,costoUnitario:2,cantidadRecibida:0}]}];
const empleados=[{id:'emp1',localId:'L1',nombre:'Ana',horasSemanales:40,pagas:14,salarioBrutoMensual:1500,costeEmpresaMensual:'',diasVacacionesAnuales:30}];
const encargos=[{id:'enc1',localId:'L1',clienteId:'cli1',fechaCreacion:'2026-09-05',fechaEntrega:'2026-09-06',señal:5,señalMedioPago:'Efectivo',total:20,lineas:[{productoId:'p1',descripcion:'Producto limpio',cantidad:2,precioUnitario:10}]}];

let d=diagnosticar({productos,pedidos,empleados,encargos,proveedores,clientes,locales,empresas});
assert.equal(d.ok,true);
assert.equal(d.soloLectura,true);
assert.equal(d.totalRegistros,4);
assert.equal(d.totalIncidencias,0,JSON.stringify(d,null,2));

// El diagnóstico nunca muta los objetos recibidos.
const escenario={
  productos:[
    {id:'dup',localId:null,nombre:'  ',costo:-1,stockMinimo:0,udsPorCaja:1},
    {id:'dup',localId:'L1',nombre:'Duplicado',costo:1,stockMinimo:0,udsPorCaja:1}
  ],
  pedidos:[
    {id:'ped-over',localId:'L1',proveedorId:'prov1',fechaEsperada:'',estado:'Recibido',items:[{productoId:'p1',cantidad:2,costoUnitario:2,cantidadRecibida:3}]},
    {id:'ped-estado',localId:'L1',proveedorId:'prov1',fechaEsperada:'',estado:'Pendiente',items:[{productoId:'p1',cantidad:2,costoUnitario:2,cantidadRecibida:2}]}
  ],
  empleados:[
    {id:'emp-name',localId:'L1',nombre:'   ',horasSemanales:40,pagas:14,salarioBrutoMensual:1000,costeEmpresaMensual:'',diasVacacionesAnuales:30},
    {id:'emp-pagas',localId:'L1',nombre:'Decimal',horasSemanales:40,pagas:14.5,salarioBrutoMensual:1000,costeEmpresaMensual:'',diasVacacionesAnuales:30}
  ],
  encargos:[
    {id:'enc-cliente',localId:'L1',clienteId:'no-existe',fechaCreacion:'2026-09-05',fechaEntrega:'2026-09-06',señal:0,señalMedioPago:'Efectivo',lineas:[{productoId:'p1',descripcion:'P',cantidad:1,precioUnitario:10}]},
    {id:'enc-total',localId:'L1',clienteId:'cli1',fechaCreacion:'2026-09-05',fechaEntrega:'2026-09-06',señal:0,señalMedioPago:'Efectivo',total:999,lineas:[{productoId:'p1',descripcion:'P',cantidad:2,precioUnitario:10}]},
    {id:'enc-sin-local',clienteId:'cli1',fechaCreacion:'2026-09-05',fechaEntrega:'2026-09-06',señal:0,señalMedioPago:'Efectivo',lineas:[{productoId:'p1',descripcion:'P',cantidad:1,precioUnitario:10}]}
  ]
};
const antes=JSON.stringify(escenario);
d=diagnosticar({...escenario,proveedores,clientes,locales,empresas});
assert.equal(JSON.stringify(escenario),antes,'el diagnóstico no debe modificar históricos');
assert.ok(d.totalIncidencias>=9,JSON.stringify(d,null,2));
const codigos=d.incidencias.map(x=>x.codigo);
for(const c of ['id_duplicado','contexto_ambiguo','sobre_recepcion_legada','estado_ambiguo','total_desfasado','referencia_inexistente','campo_obligatorio','numero_no_entero']){
  assert.ok(codigos.includes(c),`falta ${c}: ${codigos.join(',')}`);
}
assert.ok(d.incidencias.some(x=>x.dominio==='Recepción'&&x.codigo==='sobre_recepcion_legada'));
assert.ok(d.incidencias.some(x=>x.dominio==='Pedidos'&&x.id==='ped-estado'&&x.nivel==='aviso'));
assert.ok(d.incidencias.some(x=>x.dominio==='Encargos'&&x.id==='enc-sin-local'&&x.nivel==='ambiguo'));

// Nuevo hallazgo al contrastar P07 con el contrato congelado: pagas debe ser entero y nombre obligatorio.
let r=ctx.validarEmpleadoPM10({...empleados[0],pagas:14.5},{localActivoId:'L1'});
assert.equal(r.ok,false); assert.equal(r.codigo,'numero_no_entero'); assert.equal(r.campo,'pagas');
r=ctx.validarEmpleadoPM10({...empleados[0],nombre:'   '},{localActivoId:'L1'});
assert.equal(r.ok,false); assert.equal(r.campo,'nombre');

// El detector es solo lectura por construcción: no contiene setters ni persistencia.
const diagTxt=slice('function diagnosticarDatosLegadosPM10','function DiagnosticoDatosLegadosPM10');
assert.doesNotMatch(diagTxt,/setProductos|setPedidos|setEmpleados|setEncargos|window\.storage|localStorage|\.upsert\(|\.insert\(|\.update\(/);

// Integración visible: el usuario puede revisar, pero no hay botón de corrección automática.
const uiTxt=slice('function DiagnosticoDatosLegadosPM10','function DiagnosticoSincronizacion');
assert.match(uiTxt,/Solo lectura/);
assert.match(uiTxt,/no borra, migra, reasigna ni corrige automáticamente/);
assert.doesNotMatch(uiTxt,/Corregir automáticamente|Migrar ahora|Reasignar/);
const localesTxt=slice('function Locales({','function Respaldos(');
assert.match(localesTxt,/diagnosticoLegadosPM10/);
assert.match(localesTxt,/DiagnosticoDatosLegadosPM10/);
assert.match(src,/diagnosticoLegadosPM10: diagnosticarDatosLegadosPM10\(\{ productos, pedidos: pedidos2, empleados, encargos, proveedores, clientes, locales, empresas \}\)/);

console.log('PM10 P12 datos legados y ambiguos: contrato OK');

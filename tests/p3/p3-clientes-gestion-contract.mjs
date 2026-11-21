import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const archivos = ["fuente.js", "source-recovery/fuente-recuperado.js"];
for (const archivo of archivos) {
  const codigo = await readFile(archivo, "utf8");
  assert.match(codigo, /function ClientesPunto3\(/, `${archivo}: falta el panel de Clientes del Punto 3`);
  assert.match(codigo, /TIPOS_CLIENTE_SUITE/, `${archivo}: falta el catálogo de tipos de cliente`);
  assert.match(codigo, /tipoCliente/, `${archivo}: falta el campo tipo de cliente`);
  assert.match(codigo, /la_clientes_vistas/, `${archivo}: faltan las vistas guardadas`);
  assert.match(codigo, /Paginación de clientes/, `${archivo}: falta paginación real`);
  assert.match(codigo, /enmascararNifClienteSuite/, `${archivo}: falta el enmascarado del NIF en listado`);
  assert.match(codigo, /clienteAbierto.*Actividad|Secciones de la ficha/, `${archivo}: falta la ficha con actividad`);
  assert.match(codigo, /CAMPOS_ACTIVIDAD_CLIENTE_SUITE/, `${archivo}: falta el registro de cambios`);
  assert.match(codigo, /actorClienteSuite\(actorNombre\)/, `${archivo}: falta el actor de actividad`);
  assert.match(codigo, /function ClientesPunto3/, `${archivo}: falta la superficie P3 de Clientes`);
  assert.match(codigo, /const contenido = \[/, `${archivo}: el listado debe construir hijos explícitos`);
  assert.match(codigo, /No hay clientes que coincidan con los filtros\./, `${archivo}: falta el estado vacío filtrado`);
}

const bootstrap = await readFile("index-storage-bootstrap.js", "utf8");
assert.match(bootstrap, /tabla !== "clientes_empresa" && tabla !== "proveedores_empresa"/, "bootstrap: las tablas empresariales legacy no deben ordenar por updated_at");
assert.match(bootstrap, /if \(tabla !== "clientes_empresa" && tabla !== "proveedores_empresa"\) fila\.updated_at/, "bootstrap: no debe enviar updated_at a clientes_empresa/proveedores_empresa");

console.log("p3-clientes-gestion-contract: OK");

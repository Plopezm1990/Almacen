import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../../fuente.js', import.meta.url), 'utf8');
const mirror = fs.readFileSync(new URL('../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');

for (const [name, codigo] of [['fuente.js', source], ['source-recovery/fuente-recuperado.js', mirror]]) {
  assert.match(
    codigo,
    /const esPropietarioPM29 = modoEmpleado \? false : miPerfil && miPerfil\.rol \? miPerfil\.rol === "Propietario" : true;/,
    `${name}: modo empleado nunca conserva privilegios de propietario`
  );
  assert.match(
    codigo,
    /tab === "locales"[\s\S]{0,700}esPropietario: esPropietarioPM29/,
    `${name}: Locales recibe el guard efectivo`
  );
  assert.match(
    codigo,
    /tab === "configuracion"[\s\S]{0,500}esPropietario: esPropietarioPM29/,
    `${name}: Configuración recibe el guard efectivo`
  );
  assert.match(codigo, /function Respaldos\([\s\S]{0,260}esPropietario = true/, `${name}: Respaldos tiene guard de propietario`);
  assert.match(codigo, /tab === "respaldos"[\s\S]{0,500}esPropietario: esPropietarioPM29/, `${name}: Respaldos recibe el guard efectivo`);
  assert.match(codigo, /function FichaEmpresaBasica\([\s\S]{0,180}esPropietario = true/, `${name}: ficha de empresa tiene guard de propietario`);
  assert.match(codigo, /function FichaDatosLocal\([\s\S]{0,180}esPropietario = true/, `${name}: ficha de local tiene guard de propietario`);
  assert.match(codigo, /window\.__modoEmpleadoActivo = modoEmpleado === true;/, `${name}: publica el modo empleado efectivo para guardas auxiliares`);
}

console.log('PM20 P12 guard de propietario efectivo en modo empleado: PASS');

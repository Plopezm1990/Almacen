# F7 · B07 en QA — resultado de aplicación y simulador

Fecha: 2026-10-08  
Entorno: `L&A Suite QA` (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_DB_APLICADO_Y_VERIFICADO_EN_QA`  
Producción: no tocada

## 1. Fuente aplicada

La fuente de B07 ya formaba parte de `release` en el commit
`9ca58df6633da38edd259d215033a8f71802f587`.

Se aplicaron, en orden y sin modificarlos:

1. `20260930150000_abc_f4_b07_provider_registry.sql`
2. `20260930153000_abc_f4_b07_server_config.sql`
3. `20260930160000_abc_f4_b07_event_processing.sql`

Los contratos locales pasaron antes de la aplicación:

- `ABC_F4_B07_WEBHOOK_CONTRACT=PASS`;
- `ABC_F4_B07_GENERIC_PROVIDERS=PASS`;
- fixture HMAC genérico: evento normalizado, importe 22 EUR y firma HEX de 64
  caracteres.

## 2. Comprobación previa

QA confirmó antes de escribir:

- proyecto activo y saludable, PostgreSQL 17;
- presentes `locales`, `abc_resolver_intento` y `private.abc_request_hash`;
- ausentes las tablas privadas, la tabla de eventos y las dos RPC de B07;
- ninguna migración B07 registrada;
- `abc-b07-webhook` no estaba desplegada.

## 3. Registro remoto

| Versión remota | Nombre |
|---|---|
| `20261008172939` | `20260930150000_abc_f4_b07_provider_registry` |
| `20261008172943` | `20260930153000_abc_f4_b07_server_config` |
| `20261008172947` | `20260930160000_abc_f4_b07_event_processing` |

## 4. Contrato estructural

El contrato remoto devolvió `ABC_F4_B07_CONFIG=PASS` y comprobó:

- tablas de configuración en `private`, con RLS y sin lectura para clientes;
- ningún valor de secreto persistido en la base de datos;
- resolución de configuración ejecutable solo por `service_role`;
- tabla de eventos con RLS, cerrada incluso para acceso directo de
  `service_role`;
- procesador de eventos ejecutable solo por `service_role`;
- unicidad de proveedor, cuenta y evento.

## 5. Simulador transaccional

Se creó un proveedor ficticio, una cuenta, un cobro y un intento dentro de una
transacción. El ensayo verificó:

1. evento coherente: pago e intento pasan a `CONFIRMADO`;
2. replay exacto: una sola aplicación económica;
3. misma clave con payload distinto: conflicto registrado sin segundo efecto;
4. evento nuevo con importe distinto: `RECHAZADO` sin alterar el pago.

El ensayo terminó deliberadamente con
`B07_QA_SMOKE_PASS_ROLLBACK`. Después se comprobó que quedaron en cero los
proveedores, cuentas comerciales, eventos, usuario, perfil, empresa, local,
pago e intento del fixture.

## 6. Advisors

El asesor informó que las tres tablas tienen RLS sin políticas. Es el diseño
esperado: se revocó todo acceso directo a `public`, `anon`, `authenticated` y
`service_role`; solo las RPC cerradas de servidor pueden acceder.

Rendimiento informó una clave foránea sin índice de cobertura en
`private.abc_b07_cuentas_comerciales` y un índice de eventos todavía sin uso.
Son avisos `INFO` con las tablas vacías y se revisarán antes de producción.

## 7. Límite pendiente

La Edge Function `abc-b07-webhook` no se desplegó. Un webhook público necesita
autenticación propia porque un proveedor externo no presenta un JWT de usuario.
El código exige HMAC de proveedor o `ABC_B07_SIMULATION_SECRET`; hoy no existe
un proveedor contratado ni un secreto de simulación configurado en QA.

Desplegar el endpoint sin poder completar un recorrido HTTP positivo no cerraría
la prueba. El núcleo B07 queda disponible y probado en QA; el endpoint y el
sandbox real siguen bloqueados hasta configurar ese secreto o contratar el
proveedor.

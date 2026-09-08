# PM08 — Cierre y evidencia de QA

Fecha de cierre: 5 de septiembre de 2026  
Paquete: PM08 — Caja y devoluciones indivisibles  
Rama exclusiva: `pm08-caja-devolucion-indivisible`  
Pull request de validación: `#23` (sin fusión)  
Entorno de datos: Supabase QA `qjqorixtkilwsndqayyx`  
Entorno web: Deploy Preview de Netlify `chic-entremet-9107cf`

## Resultado

PM08 queda técnicamente validado para su cierre de paquete. No se ha modificado
`main`, no se ha fusionado la PR, no se ha publicado producción y no se ha
iniciado PM09.

## Alcance validado

- Libro de caja con entradas, retiradas y reembolsos.
- Arqueo diario por local, incluido efectivo contado igual a cero.
- Anulación trazable de arqueos y reverso trazable de movimientos, sin borrado
  físico del original.
- Devolución de cliente indivisible: devolución, stock y efecto de caja dentro
  de una única operación transaccional.
- Devolución a proveedor indivisible y sin posibilidad de stock negativo.
- Selección obligatoria de la venta original y límite acumulado de cantidad e
  importe reembolsable.
- Idempotencia frente a doble pulsación, reintentos y respuestas inciertas.
- Conservación y recuperación del mismo identificador de operación pendiente.
- Aislamiento por usuario, empresa y local, incluido el aislamiento de las
  rutas de repetición de reversos y anulaciones.
- Bloqueo operativo de locales inactivos.
- RLS, permisos mínimos y bloqueo de escrituras directas.

## Pruebas ejecutadas

| Bloque | Resultado |
|---|---:|
| Contratos frontend PM08 | 47/47 |
| Contratos de migración PM08 | 51/51 |
| Endurecimiento de replay PM08 | 12/12 |
| Regresión heredada PM07 | 25/25 |
| Regresión heredada PM05 | 28/28 |
| Total automático y regresión | 163/163 |
| Verificaciones funcionales en Supabase QA | 83/83 |

Se probaron flujo normal, cero, negativos, valores extremos, campos vacíos,
doble envío, concurrencia, reintento, falta de stock, devolución superior a la
venta, cierre previo de caja, usuario sin sesión, usuario inactivo, Local A1,
Local A2, Empresa B1 y local inactivo.

## Incidencia encontrada y corregida durante QA

Las rutas de repetición de la anulación de arqueo y del reverso de caja podían
devolver el registro idempotente antes de volver a comprobar el ámbito del
local. Se endurecieron ambas rutas para validar el alcance antes de responder.
Los contratos específicos y las pruebas cruzadas posteriores pasaron 12/12.

## Base de datos QA

Migraciones aplicadas:

- `20260904233204 pm08_caja_devolucion_indivisible`
- `20260904233527 pm08_replay_scope_hardening`

Comprobaciones finales:

- Cinco tablas PM08 con RLS activa.
- Escrituras directas revocadas.
- Acceso anónimo denegado.
- RPC públicas limitadas a usuarios autenticados.
- Funciones auxiliares internas no ejecutables por clientes.
- Diez índices válidos.
- Cero restricciones inválidas.
- Datos de prueba retirados.
- Stock A1 restaurado a 18 unidades en almacén y 5 en sala: total 23.
- Cero filas PM08 de prueba después de la limpieza.

## Deploy Preview

- URL: `https://deploy-preview-23--chic-entremet-9107cf.netlify.app`
- Deploy ID: `6a9b72cf5a8dd90007f1b91b`
- Commit desplegado: `7b2aa0f1500ecfc5dce551196f5434655411a314`
- Contexto: `deploy-preview`
- Estado: `ready`
- Errores de construcción: ninguno.
- Siete reglas de cabeceras procesadas correctamente.
- `published_at`: vacío; no es un despliegue de producción.

## Validación de interfaz y limitación conocida

Los 47 contratos de frontend validan estructura y comportamiento de Caja,
Arqueos y Devoluciones: mínimos numéricos, cero permitido donde corresponde,
venta original, medio de reintegro, mensajes de espera, bloqueo de doble clic,
recuperación de borradores y ausencia de borrado físico. La estructura común
usa navegación adaptable, barra horizontal controlada en móvil, contenedores de
ancho completo y rejillas compactas.

La observación visual autenticada del Deploy Preview no pudo completarse porque
Netlify protege los entornos no productivos mediante inicio de sesión de equipo
y el flujo de autenticación del navegador remoto no respondió. La protección
no se desactivó ni se relajó. Esta limitación no invalida las pruebas
transaccionales y de aislamiento ya ejecutadas, pero deberá realizarse un smoke
visual autenticado antes de autorizar cualquier futura publicación en
producción.

## Riesgo diferido

`efectivo_base` continúa llegando desde la instantánea calculada por el
frontend. PM08 protege el libro de caja y calcula el efecto de sus movimientos
en servidor, pero la reconciliación completamente autoritativa de la base de
ventas queda documentada para un paquete posterior. No se inicia ese trabajo en
este cierre.

## Decisión de cierre

PM08: **CERRADO CON LIMITACIÓN VISUAL DOCUMENTADA**.

La PR de validación debe cerrarse sin fusionar. La rama y sus evidencias se
conservan para trazabilidad. Cualquier paso hacia producción requiere una
autorización nueva y explícita.

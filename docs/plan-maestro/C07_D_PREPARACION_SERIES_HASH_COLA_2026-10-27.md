# C07-D · Preparación de series por emisor, registro, hash y cola

Fecha: 27/10/2026  
Entorno inspeccionado: Supabase QA (`qjqorixtkilwsndqayyx`)  
Producción: **no consultada para cambios y no modificada**.

## Estado de esta entrega

**Preflight, reconciliación C05 y primera migración C07-D en QA: TERMINADOS.**

Al inicio no se aplicó directamente C07-D. El motivo era importante: QA ya
tiene C05 aplicado y conserva documentos numerados, pero las series actuales
están definidas por empresa, local, tipo y código de serie. C07-D necesita una
identidad fiscal por empresa y emisor. Añadir una cadena de hashes encima de la
identidad actual sin reconciliarla permitiría mezclar dos locales del mismo
emisor o reiniciar una cadena por un cambio de local.

Después de comprobar que el mapeo era determinista, se aplicaron en QA las
migraciones `abc_f7_c07d_c05_reconcile` y
`abc_f7_c07d_fiscal_chain_queue`, más los índices de cobertura de claves
foráneas. El hardening de concurrencia de la cadena quedó aplicado mediante
SQL idempotente directo en QA porque el conector `apply_migration` expiró dos
veces con ese bloque concreto; el SQL versionado permanece en
`20261027133000_abc_f7_c07d_chain_hardening.sql`.
Los mapeos ambiguos siguen provocando aborto explícito.

## Preflight observado en QA

- C05 está aplicado en QA. Existen las tablas
  `public.abc_c05_series_documentales` y
  `public.abc_c05_documentos_emitidos`.
- QA tiene la RPC `abc_configurar_serie_documental`, además de las RPC de
  reserva y resolución. Esa RPC de configuración existe en el servidor, pero
  su definición no está presente en la migración C05 que actualmente figura en
  este checkout. Hay que reconciliar esta deriva antes de crear la siguiente
  migración.
- La empresa `QA-EMP-A` tiene un emisor fiscal (`QA Fiscal A2`) vinculado tanto
  a `QA-A1` como a `QA-A2`.
- En `QA-A1` existen dos series de factura: `FA` y `TPV`.
- Los documentos C05 existentes de `QA-A1` están numerados y emitidos: tres
  documentos en `FA` y cinco en `TPV`.
- `public.abc_c05_series_documentales` y
  `public.abc_c05_documentos_emitidos` ya tienen `entidad_fiscal_id`; el
  backfill terminó con cero nulos, conservando las dos series y los ocho
  documentos existentes.
- Ya existen `abc_c07d_registros_fiscales` y `abc_c07d_cola_fiscal`, ambas con
  RLS y sin DML directo para los roles de API. La tabla genérica
  `efectos_pendientes` no se reutiliza.
- Los asesores de Supabase siguen mostrando avisos generales ya conocidos del
  proyecto. No se interpretan como bloqueo C07-D mientras las tablas nuevas no
  se expongan por DML directo y sus RPC mantengan el control de alcance.

## Decisiones técnicas de C07-D

### 1. Identidad de la cadena

La cadena se particionará por:

`empresa_id + entidad_fiscal_id`

El local será un dato de origen y autorización, pero no reiniciará la cadena.
La serie documental también deberá quedar ligada al emisor para impedir que dos
locales usen accidentalmente la misma combinación legal de serie y número.

No se declarará cumplimiento Veri*Factu ni conformidad AEAT por implementar
esta cadena técnica. El formato fiscal definitivo y el adaptador se validarán
en una etapa posterior con asesoría y proveedor/sandbox.

### 2. Reconciliación obligatoria de C05

Antes de la migración C07-D se preparará una migración separada que:

1. incorpore `entidad_fiscal_id` a series y documentos, con sus claves
   foráneas y controles de empresa;
2. haga backfill solo cuando el vínculo emisor-local sea único y determinista;
3. aborte si una serie o documento no puede mapearse sin elegir de forma
   arbitraria;
4. conserve el número y el estado de todos los documentos existentes;
5. cambie la unicidad fiscal a empresa + emisor + tipo + serie + número;
6. mantenga el local como origen operativo y filtro de autorización;
7. reconcilie en el repositorio la RPC de configuración de series que ya existe
   en QA pero falta en la fuente local.

No se hará un `UPDATE` masivo que adivine el emisor ni se borrarán series o
documentos históricos.

### 3. Registro fiscal técnico

La propuesta de tabla `abc_c07d_registros_fiscales` conservará, como mínimo:

- empresa y emisor fiscal;
- documento C05 relacionado;
- tipo de registro y versión del registro;
- snapshot fiscal mínimo e inmutable;
- hash anterior;
- hash actual SHA-256;
- actor, operación idempotente y fechas;
- estado técnico y motivo de bloqueo.

La inserción del registro y el avance de la cadena serán una sola transacción.
La fila será inmutable después de confirmarse; una corrección o anulación
generará un registro relacionado, nunca una reescritura.

La canonicalización se especificará en el contrato antes de programar el hash:
objeto JSON con claves ordenadas, codificación UTF-8, sin secretos y con el
hash anterior incluido en la entrada. `jsonb::text` solo se aceptará si el
contrato local demuestra una salida estable para todos los tipos admitidos.

### 4. Cola fiscal dedicada

La propuesta de tabla `abc_c07d_cola_fiscal` tendrá una fila idempotente por
registro y destino lógico. Estados mínimos:

`PENDIENTE`, `EN_PROCESO`, `ACEPTADO`, `RECHAZADO`, `ERROR`, `DESCONOCIDO`.

La cola conservará intentos, próxima reintentabilidad, último error, clave de
idempotencia, referencia externa opaca y marca de reclamación del worker.

- El navegador no reclamará ni modificará la cola.
- Un worker servidor será el único que reclame y confirme entregas.
- Una respuesta desconocida no creará un segundo registro ni una segunda
  factura.
- `RECHAZADO` y `DESCONOCIDO` conservarán evidencia y no se convertirán
  silenciosamente en aceptados.
- En C07-D QA el destino será un simulador controlado; no se llamará a AEAT.

## Seguridad y alcance

- Tablas con RLS activado y sin DML directo para `anon`, `authenticated` ni
  `service_role`.
- RPC públicas mínimas, con `SECURITY DEFINER`, `search_path` vacío,
  validación de `auth.uid()`, empresa, local, emisor y capacidad.
- El worker no recibirá certificados ni claves desde el navegador.
- No se guardarán secretos, PEM, contraseñas, endpoints editables ni tokens en
  el snapshot, el hash, la cola, `localStorage` o el repositorio.
- C07-D no activa emisión, no habilita Veri*Factu productivo y no cambia
  producción.

## Matriz de pruebas que cerrará C07-D

1. Reconciliación de las series C05 existentes sin cambiar números.
2. Dos locales del mismo emisor usan una misma serie legal sin duplicar
   números.
3. Dos emisores de una empresa no comparten cadena ni contador.
4. Dos empresas no pueden leer ni reservar datos cruzados.
5. Dos reservas concurrentes producen números distintos.
6. El mismo `operation_id` recupera el mismo documento y el mismo hash.
7. Una reserva pendiente, error o respuesta desconocida no crea otra factura.
8. El registro confirmado conserva el hash anterior y el hash actual.
9. Una modificación directa o una reescritura de un registro confirmado falla.
10. Un worker no puede reclamar una fila de otro emisor.
11. La reanudación de un worker recupera una reclamación vencida sin duplicar
    entrega.
12. La modalidad fiscal no validada bloquea la cola de transporte.
13. La representación revocada bloquea nuevos envíos, pero conserva cola e
    historial.
14. Todos los ensayos de emisión usan simulador y terminan sin residuos no
    documentados.

## Siguiente paso exacto

Completar el contrato funcional de C07-D con la integración de la emisión
documental: registrar el documento `EMITIDO`, generar el registro fiscal,
encolarlo y mostrar el estado de la cola en el panel de QA. Después se hará un
ensayo persistente controlado y el cierre de evidencia. La AEAT real y
producción siguen fuera.


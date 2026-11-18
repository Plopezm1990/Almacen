# P2 · org-33 · Sala, zonas y mesas

Fecha: 18/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador  
Entorno permitido: Deploy Preview / Supabase QA. Producción no se toca.

## Decisión de alcance

`org-33` se divide en dos capacidades con contratos server-side diferentes:

1. **Zonas y mesas:** contrato de sala integrado en la pantalla
   `Configuración → Sala y mesas`.
2. **Tarifas horarias:** el QA actual sí expone las tablas y las RPC de T8
   pieza 3 (`abc_guardar_tarifa_horario` y `abc_guardar_tarifa_precio`). La
   rama local no contiene esa migración porque fue revertida en la historia;
   por eso la UI detecta el contrato en tiempo de ejecución y solo muestra el
   editor cuando puede leerlo. En un entorno sin la migración se mantiene una
   reserva honesta, sin persistencia local.

No se reutilizan las zonas de almacén como si fueran zonas de sala. Las tarifas
se aplican al local completo por día y hora; no se atribuyen a una zona porque
ese no es el alcance de T8 pieza 3.

## Contratos utilizados

- `abc_listar_mapa_sala` para la lectura del plano real, el día operativo y el
  contexto de terminal/sesión.
- `abc_crear_zona` y `abc_actualizar_zona` para el catálogo de zonas.
- `abc_crear_mesa` y `abc_actualizar_mesa` para el catálogo de mesas.
- lectura autenticada de `catalogo_tpv_tarifas_horario`,
  `catalogo_tpv_tarifa_precios` y `catalogo_tpv_productos`;
- `abc_guardar_tarifa_horario` y `abc_guardar_tarifa_precio` para las tarifas
  y sus precios especiales.

Las cuatro mutaciones exigen `ABC_SALA_CONFIGURAR`, sesión de terminal abierta,
día operativo, UUID de operación y versión esperada en las ediciones. La UI no
hace DML directo y conserva el control de concurrencia del servidor.

## Implementación inicial

La nueva sección `Sala y mesas` se monta dentro de `ConfiguracionLocal` y:

- carga el mapa real del local mediante `cargarMapaSalaA07({ paraPanel: true })`;
- muestra zonas, tipo, estado y versión;
- muestra las mesas de cada zona, capacidad y estado efectivo;
- permite abrir formularios de nueva/edición de zona y mesa;
- exige código, nombre, tipo, capacidad y orden válidos antes de llamar al
  servidor;
- usa `p_expected_version` al actualizar para no pisar cambios de otro
  terminal;
- muestra estados de error y confirmación accionables;
- conserva áreas táctiles del sistema Órbita y una rejilla responsive;
- muestra las tarifas horarias existentes cuando QA expone T8 pieza 3;
- exige motivo de cambio en cada tarifa y precio especial, y deja el estado
  inactivo visible;
- si faltan las tablas en otro entorno, deja el aviso de contrato ausente sin
  fingir que ha guardado nada.

La acción de guardar está implementada, pero no se ha pulsado en QA durante
esta tanda. No se han creado ni editado zonas o mesas reales.

## Condiciones de cierre QA

Para pasar `org-33` a **Pasa** todavía falta, con autorización explícita para
mutaciones reversibles:

1. abrir la sección con el propietario en QA-A1;
2. comprobar lectura del mapa y persistencia tras recarga;
3. crear una zona de ensayo y una mesa de ensayo;
4. editar la zona y la mesa comprobando conflicto de versión en una segunda
   sesión o terminal;
5. desactivar únicamente los registros de ensayo, nunca QA-A1 ni mesas con
   cuentas abiertas;
6. medir escritorio 1440×900 y móvil 390×844 sin desbordamiento;
7. actualizar la matriz y el traspaso con IDs, versiones y limpieza.

Hasta completar ese recorrido, el estado es **Construida en código; pendiente
validación QA**.

## Verificación local

- `REDISENO_ORG33_SALA_CONTRACT=PASS`
- `REDISENO_P1_FISCAL_TPV_CONTRACT=PASS`
- `REDISENO_P06_PROPINA_CONTRACT=PASS`
- `SOURCE_RECOVERY_CHECK=PASS`
- `git diff --check`: limpio

Descubrimiento QA de T8 pieza 3: las tablas existen y hay 1 fila de tarifa en
el proyecto `qjqorixtkilwsndqayyx`; las RPC públicas aceptan los contratos de
guardado descritos arriba. Todavía no se ha pulsado ningún guardado de tarifa.

SHA de implementación: `4abbc0ea`
SHA de contrato y espejo: `df03c029`
SHA de la corrección de tarifas: pendiente de commit

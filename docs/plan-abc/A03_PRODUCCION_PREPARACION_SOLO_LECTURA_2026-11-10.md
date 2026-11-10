# A-03 — Preparación de producción en solo lectura

Fecha: 2026-11-10  
Producción: `flqercbgpgmmfaakrwkc` («L&A Suite»)  
QA: `qjqorixtkilwsndqayyx` («L&A Suite QA»)  
Rama candidata: `codex/fase3-a03-a04`  
Último commit de la rama: `f74848dd605a501406ee0576eb6fd2da77772add`

## Decisión de seguridad

No se aplica ninguna migración en producción durante esta auditoría. La regla vigente es que producción solo se puede leer y navegar. La autorización genérica recibida después del bloqueo no se interpreta como una excepción a esa regla.

El objetivo de este documento es dejar preparado el paquete para una futura ventana explícita, con preflight de solo lectura y criterios verificables. No es una autorización de despliegue.

## Estado medido antes de la preparación

- QA tiene las cuatro tablas APPCC, RLS y políticas para `authenticated`.
- QA tiene las cinco RPC APPCC y los contratos focalizados pasan.
- QA contiene 4 puntos, 4 lecturas, 1 corrección y 2 cancelaciones.
- Las 4 lecturas tienen punto, valor, fecha/hora y actor.
- Producción no tiene las cuatro tablas APPCC ni las cinco RPC APPCC.
- Producción no se ha modificado.

La evidencia detallada está en [F3_A03_A04_EVIDENCIA_2026-11-09.md](F3_A03_A04_EVIDENCIA_2026-11-09.md).

## Paquete versionado y orden previsto

Si en el futuro existe una ventana autorizada, el orden de revisión del paquete es el orden lexicográfico de las migraciones:

1. `20261109150000_a03_a04_appcc_y_atribucion.sql`
2. `20261109170000_a03_appcc_cancelacion_append_only.sql`
3. `20261109180000_a03_appcc_puntos_server_side.sql`
4. `20261109201101_a03_appcc_correction_response.sql`

El orden debe conservarse porque la primera migración crea las tablas y las RPC base; las siguientes añaden cancelación, operaciones server-side de puntos y la corrección de la respuesta append-only.

## Preflight obligatorio

Antes de cualquier aplicación futura, ejecutar únicamente el fichero [A03_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-11-10.sql](A03_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-11-10.sql) contra producción con el ayudante de auditoría. Debe comprobarse:

- que las cuatro tablas están ausentes o que cualquier presencia parcial queda explicada;
- que las cinco firmas RPC están ausentes o coinciden con una aplicación anterior documentada;
- que las dependencias `private.la_usuario_activo()`, `private.la_tiene_local()` y `private.la_tiene_empresa()` existen;
- que el historial de migraciones no contiene ya las cuatro versiones;
- que no hay una aplicación parcial que haga inseguro repetir el paquete.

Una ejecución que no cumpla esas condiciones debe detener la ventana. El preflight no contiene operaciones de modificación.

## Resultado del preflight de producción — 2026-11-10

El preflight se ejecutó contra `flqercbgpgmmfaakrwkc` en solo lectura. Las tres dependencias internas existen: `private.la_usuario_activo()`, `private.la_tiene_local(text,text)` y `private.la_tiene_empresa(text)`. No hay aplicación parcial: las cuatro tablas APPCC, las cinco RPC, las políticas APPCC y las cuatro versiones de migración siguen ausentes.

El resultado es coherente con el paquete preparado y no autoriza por sí mismo a aplicarlo. El siguiente paso técnico sería una ventana de migración explícitamente autorizada; mientras siga vigente la regla de producción solo lectura, A-03 permanece bloqueado.

## Verificación posterior prevista

Solo después de una aplicación autorizada se podrían comprobar, en lectura:

- las cuatro tablas y sus claves externas;
- RLS activo y políticas de alcance por empresa/local;
- ejecución autenticada de las cinco RPC;
- ausencia de ejecución para `anon` y `public`;
- huellas `md5(pg_get_functiondef(...))` de cada firma entre QA y producción;
- una reproducción funcional equivalente a QA, sin reutilizar datos sintéticos de producción.

Hasta que esas comprobaciones existan, A-03 permanece abierto. La prueba QA no acredita producción.

## Rollback y límite operativo

El paquete no se presenta como reversible mediante un bloque destructivo automático: las tablas y registros APPCC forman parte de la remediación y una eliminación ciega podría destruir trazabilidad. La estrategia de recuperación debe ser una decisión independiente del responsable de producción, basada en copia/restore y ventana controlada. No se ejecuta ni se inventa aquí.


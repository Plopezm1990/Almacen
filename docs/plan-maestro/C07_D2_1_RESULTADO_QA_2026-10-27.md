# ABC F7 C07-D.2.1 — configuración de emisión por empresa en QA

Fecha: 2026-10-27
Ámbito: Supabase QA `qjqorixtkilwsndqayyx`.
Producción: no modificada. AEAT: no conectada.

## Objetivo

Crear la configuración persistente que conecta una empresa, su local, una
entidad fiscal, un tipo de documento, una serie C05 y un adaptador fiscal
server-side. La configuración no contiene certificados, claves, contraseñas,
tokens ni endpoints editables.

## Implementación

La migración `20261027150000_abc_f7_c07d_d2_emission_config.sql` añade:

- Catálogo privado `abc_c07d_adaptadores_fiscales`.
- Adaptador QA `SIMULADOR_C07D`, versión `1.0.0`, con transporte `DISABLED`.
- Configuración privada `abc_c07d_emision_config`, aislada por empresa, local,
  entidad fiscal y tipo documental.
- Referencia C05 `serie_id`, validada contra la entidad, local y tipo.
- Ambiente `QA`, `SANDBOX` o `PRODUCCION`.
- Referencia opaca opcional a credencial server-side; nunca el secreto.
- Estados `BORRADOR`, `VALIDADA`, `ACTIVA` y `BLOQUEADA`.
- Historial privado inmutable en `abc_c07d_emision_config_revisiones`.
- RPCs autenticadas para listar adaptadores, leer configuración y guardar con
  control de versión e idempotencia.

La activación `ACTIVA` sigue bloqueada hasta la revisión posterior. La
configuración QA se puede dejar en `VALIDADA`, pero eso no conecta con AEAT ni
autoriza producción.

## Evidencia QA

Se configuró de forma persistente la fixture:

- Empresa: `QA-EMP-A`.
- Local: `QA-A1`.
- Entidad fiscal: `a0000000-0000-0000-0000-0000000000a2`.
- Tipo: `FACTURA`.
- Serie: `TPV`.
- Adaptador: `SIMULADOR_C07D`.
- Ambiente: `QA`.
- Estado: `VALIDADA`.
- Credencial configurada: `false`.

La lectura autenticada devuelve la configuración y la serie sin exponer una
credencial. La repetición de la misma operación devuelve el mismo resultado.

Pruebas negativas realizadas:

- Configuración con `password`: rechazada con `C07D_CONFIG_NO_ADMITE_SECRETOS`.
- Versión esperada obsoleta: rechazada con `C07D_CONFIG_VERSION_OBSOLETA`.
- Lectura directa de la tabla privada con `authenticated`: rechazada por
  permisos/RLS.
- Primera alta inicialmente bloqueada por un defecto del trigger `INSERT`;
  se corrigió con `20261027151000_abc_f7_c07d_d2_emission_config_fix.sql` y la
  segunda alta pasó correctamente.
- El catálogo de adaptadores se corrigió para no asumir que un local tiene una
  sola entidad fiscal activa mediante
  `20261027152000_abc_f7_c07d_d2_adapter_scope_fix.sql`.

## Límites

Esta entrega todavía no conecta `abc_c07d_emitir_checkout` con la configuración
persistentemente guardada. Ese es el siguiente subpunto C07-D.2.2: el servidor
deberá resolver la serie y el adaptador configurados y no aceptar una serie
libre del frontend, manteniendo el adaptador simulado y QA aislada.

No se ha modificado producción, no se ha usado el proyecto Supabase de
producción y no se ha contactado con la AEAT.

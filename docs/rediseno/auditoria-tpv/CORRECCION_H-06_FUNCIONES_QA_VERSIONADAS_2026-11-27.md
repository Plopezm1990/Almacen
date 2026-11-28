# Corrección H-06 · funciones de QA sin migración · 27/11/2026

Estado: **volcado y versionado; sin cambios en el servidor.** Rama `correccion/ola0-tpv-2026-11-26`.
Es la primera pieza de la Ola 2 (seguridad) y desbloquea H-27 y H-23.

## Qué se hizo

Se leyó del servidor de QA la definición viva de las **14 funciones `abc_*` sin migración** más la privada
de apoyo `private.abc_qa_c04_propietario` y se guardaron en `supabase/qa-only/funciones/` (una por archivo).
**No son migraciones**: no están en `supabase/migrations`, así que no se aplican a producción por esa vía.
Cada archivo coincide byte a byte con QA (`md5` de `pg_get_functiondef` sin retornos de carro).
Además: `REGISTRO.json` (firma, `md5`, clase y nota de seguridad de cada una), `README.md` y la definición
leída de la tabla `abc_vales_regalo`.

Contrato `tests/rediseno/h06-funciones-qa-versionadas-contract.mjs` (comprobado con dos mutantes):
1. cada archivo coincide con el `md5` del registro y define exactamente esa función;
2. **ninguna migración las define** (si una pasa a migración real hay que sacarla del registro);
3. las de «solo QA» llevan su barrera `QA-EMP-A` / `QA-A1` (propia o delegada) y la aplicación no llama a
   ninguna `abc_qa_*`; `abc_preparar_ticket_fiscal_qa` solo se prepara bajo el interruptor de QA.

## Revisión de seguridad (lo que no se había leído)

| Clase | Funciones | Conclusión |
|---|---|---|
| **Solo QA con barrera (6)** | `abc_qa_confirmar_pago_simulado`, `abc_qa_cancelar_pago_cierre`, `abc_qa_compensar_efecto_cierre`, `abc_qa_listar_pendientes_cierre`, `private.abc_qa_c04_propietario`, `abc_preparar_ticket_fiscal_qa` | Limitadas por construcción a `QA-EMP-A` / `QA-A1`; las `abc_qa_*` además a Propietario y a una sesión en `CIERRE_PROVISIONAL`. Si llegaran a otro entorno **rechazarían cualquier otra empresa o local**. |
| **Solo QA sin escritura (1)** | `abc_preparar_bizum_qa` | `SECURITY INVOKER`, no lee ni escribe tablas: devuelve constantes marcadas `PREPARADO_QA`. |
| **Producto que solo existe en QA (8)** | vale regalo (3), ticket por correo (2), cajón e impresora simulados (2), guardar tipo de negocio (1) | **No son simuladores de QA: son funciones de producto que nadie migró.** Están bien guardadas (capacidad por local, operación idempotente), pero producción no las tiene. |

**El vale regalo es el caso grave de deriva:** la tabla `abc_vales_regalo` (RLS activada, sin políticas, sin
privilegios para `authenticated` ni `anon`, 2 filas) y sus tres funciones existen en QA y en **ningún**
archivo del repositorio. Si el vale regalo se quiere en producción hace falta una migración real con tabla y
contrato; hoy no se podría reconstruir QA desde cero con el repositorio.

## Qué NO se ha comprobado

- **Producción:** fuera del alcance, no se ha mirado si tiene alguna de estas funciones.
- **La función Edge `qa-card-worker`** (resuelve intentos de tarjeta con la clave de servicio) sigue sin código en el
  repositorio; se pueden consultar sus metadatos con la herramienta de funciones Edge, pero no se ha volcado.
- **Otras deudas de QA:** las migraciones `20261113090000`, `20261113140000` y `20261120120000` se aplicaron fuera del
  historial, y `20261115120000_mfa_politica_opcional` no está aplicada (evidencias del 25/11).

## Siguiente

- **H-27 y H-23** (botón «Aprobar/Rechazar tarjeta simulada» solo en QA y repetir la venta mixta por la interfaz):
  ya hay una base gobernada.
- Decidir si el vale regalo, el ticket por correo y «tipo de negocio» pasan a migraciones reales.

# M-01 — seguimiento RLS de la tabla privada de PIN

Fecha: 2026-11-10  
Entorno modificado: QA (`qjqorixtkilwsndqayyx`)  
Producción (`flqercbgpgmmfaakrwkc`): solo lectura

La alerta de seguridad de Supabase detectó que la tabla privada
`private.pm11_empleado_pin` tenía RLS desactivado. La migración original ya
revocaba el acceso directo y exponía únicamente RPC `SECURITY DEFINER`, pero
ACL y RLS son defensas distintas.

Se añadió la migración separada
`20261110190000_m01_enable_pin_rls.sql`. No reescribe la migración histórica ni
crea políticas de lectura directa: activa RLS sobre la tabla privada y verifica
el postflight mediante `pg_class.relrowsecurity`. El contrato
`tests/m01/m01-pin-rls-contract.mjs` pasó junto con el contrato original de
M-01, F7 y el validador del manifiesto.

La migración se aplicó exclusivamente en QA. Medición posterior:

- `relrowsecurity = true`;
- `SELECT` directo denegado a `anon` y `authenticated`;
- RPC de verificación presente;
- 0 filas legacy con `datos.pin`;
- 1 fila privada sintética, ya declarada por M-01.

La reproducción funcional del PIN siguió pasando después de activar RLS. El
asesor ahora informa `rls_enabled_no_policy` como INFO para esta tabla privada;
no se interpreta como fallo: no hay acceso directo que autorizar. El aviso
anterior de RLS desactivado ha desaparecido. Producción no se modificó.

Esto deja M-01 corregido y reproducido en QA, pero no certificado globalmente:
la promoción de la migración y la eliminación del único PIN legacy de
producción requieren una ventana autorizada y siguen fuera de esta auditoría.

## Revalidación de estado — 2026-11-11

La lectura actual confirma en QA la tabla `private.pm11_empleado_pin`, RLS
activo y una fila privada sintética ya declarada. En producción,
`to_regclass('private.pm11_empleado_pin')` sigue devolviendo `NULL`; no se
intentó consultar ni crear filas de esa tabla allí. QA conserva además 165
sesiones de Auth y producción 8; estas cifras se registran como contexto de la
lectura, no como una operación sobre sesiones.

La diferencia entre entornos permanece **medida** y M-01 sigue corregido y
reproducido en QA, pero abierto en alcance global hasta que exista una ventana
autorizada para promover la migración y revisar el PIN legacy de producción.

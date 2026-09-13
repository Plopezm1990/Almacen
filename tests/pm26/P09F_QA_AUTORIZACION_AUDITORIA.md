# PM26 P09f-A — Ensayo QA aislado de autorización de auditoría

**Estado: EJECUTADO Y VERIFICADO PARA LA RPC DE AUDITORÍA.**

Este ensayo ejercita registrar_auditoria en QA dentro de una única
transacción que termina siempre en ROLLBACK. No se usaron usuarios ni datos
reales y no quedó ninguna fila de prueba después de la comprobación final.

## Casos ejecutados

| Caso | Resultado |
| --- | --- |
| Propietario con membresía de su empresa/local | Permitido |
| Propietario contra empresa ajena | Bloqueado |
| Propietario contra local ajeno | Bloqueado |
| Llamada sin sesión | Bloqueada |

La prueba crea dos identidades sintéticas, sus perfiles, empleados y
membresías solo dentro de la transacción. La identidad se simula mediante el
claim de sesión para comprobar la misma ruta de autorización que consulta la
RPC; no se usa una credencial administrativa para hacerse pasar por un usuario.

## Recuperación y limpieza

El primer montaje fue rechazado por una restricción válida del entorno sobre
el estado del empleado. El segundo fue rechazado porque QA exige que la
membresía exista antes de enlazar el perfil. Ambos abortaron antes de la RPC y
se revirtieron. El tercer ensayo, con el orden y los valores admitidos,
completó los cuatro casos en verde y terminó con ROLLBACK.

La verificación posterior encontró cero usuarios, empleados, perfiles,
membresías y auditorías identificados como prueba P09f.

## Límite honesto

Este resultado valida la autorización de la RPC de auditoría y el mecanismo
de ensayo reversible en QA. No valida todavía las otras doce RPC, ni la
compatibilidad de relaciones, caja, finanzas, stock o devoluciones. Esas
pruebas requieren sus propios datos aislados e invariantes contables antes de
plantear producción.

## Límites respetados

- QA: datos temporales dentro de una transacción revertida; sin residuos.
- Producción y TPV: no tocados.
- Sin despliegue de Netlify o Edge Functions.
- Sin cambios en main, release ni la PR #38.

PM26_P09F_A_QA_AUTORIZACION=PASS

PM26_P09F_A_RESIDUOS=0

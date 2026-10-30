# Paso maestro 2 — crear la variante SQL productiva

Fecha de cierre: 30/10/2026  
Ámbito de preparación: repositorio, QA y preflight de producción en solo lectura  
Producción: no se han aplicado migraciones ni se ha escrito configuración fiscal.  
AEAT: transporte real desactivado.

## Decisión

**Paso maestro 2 terminado como preparación y validación de la variante SQL
productiva.**

La infraestructura queda preparada para una futura promoción controlada. La
promoción no se ejecuta en este paso y la activación fiscal real permanece
separada y bloqueada.

## Alcance validado

La variante contempla:

- reconciliación estructural C05 por entidad fiscal;
- tablas C07-D de registros, cadena y cola;
- claves foráneas e índices;
- configuración privada por empresa, local, entidad fiscal y serie;
- catálogo de adaptadores sin secretos ni endpoints editables;
- RLS y permisos mediante RPC autenticadas;
- historial inmutable de revisiones de configuración;
- RPC de lectura y preflight;
- RPC de emisión con bloqueo previo del transporte;
- expediente de piloto sandbox aislado por empresa;
- controles de idempotencia, doble aprobación y revocación.

## Controles de seguridad

Queda establecido que la variante productiva:

1. no copia fixtures ni filas de QA;
2. no copia la empresa ficticia `QA-EMP-A`;
3. no copia el adaptador `SIMULADOR_C07D` a producción;
4. no guarda contraseñas, tokens, certificados, PEM, claves privadas ni
   endpoints en la configuración funcional;
5. mantiene el transporte AEAT en `DISABLED`;
6. bloquea la emisión antes de reservar número, crear C05 o insertar C07-D si
   no existe configuración válida;
7. impide activar una empresa ficticia;
8. no llama al transporte real desde el frontend;
9. etiqueta el QR como QA/no fiscal mientras no exista documento real y
   adaptador autorizado;
10. conserva la separación entre infraestructura, configuración y activación.

## Preflight y contratos

Resultados obtenidos en esta revisión:

```text
ABC_F5_C07D_PREFLIGHT_CONTRACT=PASS
ABC_F7_C07D_MIGRATION_CONTRACT=PASS
ABC_F7_C07D_C05_CLEAN_FIXTURE_CONTRACT=PASS
C07D_PRODUCTION_PREFLIGHT_READ_ONLY=PASS
C07D_PRODUCTION_PREFLIGHT_CONTRACT=PASS
C07D_PRODUCTION_MANIFEST_CONTRACT=PASS
C07D_D2_CONFIG_CONTRACT=PASS
C07D_D2_WIRING_CONTRACT=PASS
C07D_D2_5_ADAPTER_CONTRACT=PASS
C07D_D2_6_ACTIVATION_DOSSIER=PASS
C07D_D3_PILOT_SANDBOX_CONTRACT=PASS
C07D_D3_PILOT_SANDBOX_MIGRATION=PASS
C07D_CHECKOUT_EMIT_CONTRACT=PASS
git diff --check=PASS
```

El manifest identifica 14 archivos candidatos, de los cuales 4 conservan
marcadores `QA-only`. La puerta resultante es:

```text
C07D_PRODUCTION_PROMOTION=BLOCKED_UNTIL_PRODUCTION_VARIANT
```

Esta puerta se conserva deliberadamente hasta una revisión humana y una
decisión de promoción independiente. No es un error del Paso maestro 2.

## Estado de producción

- Migraciones C07-D aplicadas: **NO**.
- Configuración fiscal real: **NO**.
- Empresa fiscal real: **NO**.
- Adaptador productivo: **NO**.
- Credenciales fiscales: **NO**.
- Transporte AEAT: **DESACTIVADO**.
- Datos de QA copiados a producción: **NO**.
- Cambios destructivos o escrituras realizadas durante esta etapa: **NO**.

## Criterio de cierre

El Paso maestro 2 queda cerrado porque la variante SQL productiva está definida,
aislada de QA, protegida por contratos y lista para una futura revisión de
promoción. La aplicación efectiva en producción no forma parte de este cierre;
se decidirá después de la venta controlada de producción y de la disponibilidad
de una empresa piloto real.

## Documentación de apoyo

- [C07D_VARIANTE_PRODUCCION_SEGURA_2026-10-30.md](C07D_VARIANTE_PRODUCCION_SEGURA_2026-10-30.md)
- [PREPARACION_PROMOCION_C07D_2026-10-30.md](PREPARACION_PROMOCION_C07D_2026-10-30.md)
- [PASO_MAESTRO_1_CIERRE_COMPATIBILIDAD_OPERATIVA_2026-10-30.md](PASO_MAESTRO_1_CIERRE_COMPATIBILIDAD_OPERATIVA_2026-10-30.md)

## Siguiente paso

El siguiente es el **Paso maestro 3: promover únicamente la infraestructura
aprobada**, empezando por PR/CI, revisión de preview, merge autorizado,
despliegue y comprobación de que la emisión fiscal continúa bloqueada sin
configuración real.

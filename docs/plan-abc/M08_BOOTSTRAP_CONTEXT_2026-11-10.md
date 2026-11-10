# M-08 — Bootstrap y contexto operativo

Fecha de revalidación: 2026-11-10  
QA: `qjqorixtkilwsndqayyx`  
Producción: `flqercbgpgmmfaakrwkc`

## Estado

M-08 sigue abierto. La función `public.bootstrap_owner_instalacion(text,text)` y la tabla privada de estado existen ahora en ambos entornos, pero la definición desplegada continúa siendo divergente y no se ha reproducido una instalación completa desde el navegador en esta revisión.

## Evidencia medida

La consulta de solo lectura confirmó en QA y producción:

- existe `private.la_instalacion_estado`;
- contiene una fila con generación no nula;
- existe `public.bootstrap_owner_instalacion(text,text)`;
- la ejecución está concedida a `authenticated` y no a `anon` ni a `service_role`.

La comparación actual de `pg_proc.prosrc` devuelve:

| Entorno | MD5 del cuerpo | MD5 normalizada del cuerpo | Longitud |
|---|---|---|---:|
| QA | `77104240e60fa4f5b38a2583e58808d6` | `977eb2748752ba4d101bfa278ee509db` | 3.997 |
| Producción | `2ac268ea336339890f9541df88aa2325` | `bc6019e27e50cf1597d8e8e75deb804e` | 3.356 |

La afirmación anterior de que la huella normalizada de ambos cuerpos era igual queda corregida por esta medición actual. No se presenta la divergencia como un fallo funcional concreto sin comparar y ejecutar los caminos afectados, pero sí como una diferencia de procedencia y definición que impide certificar equivalencia.

## Límites y no acciones

No se invocó el bootstrap en producción. Tampoco se invocó en QA durante esta revalidación: la función puede crear empresa, local y membresía cuando se cumplen sus precondiciones, y no se necesitaba crear más datos sintéticos para medir la divergencia. No se modificaron usuarios, empresas, locales ni membresías.

La migración versionada de N-02 contiene una definición canónica y el contrato local la protege, pero eso es **probado por código**; no acredita que producción la tenga aplicada. Cerrar M-08 requiere una comparación funcional de la definición canónica con ambos despliegues y una reproducción controlada del flujo de instalación en QA, seguida de una ventana autorizada si se decide reconciliar producción.


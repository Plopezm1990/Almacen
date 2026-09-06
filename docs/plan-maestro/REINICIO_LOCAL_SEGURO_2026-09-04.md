# Reinicio local seguro · 2026-09-04

Estado: VALIDADO EN RAMA DE PRUEBAS. NO APLICADO A PRODUCCIÓN.

## Objetivo

Dejar L&A Suite sin datos locales heredados de Chocoloyos después de haber vaciado los datos operativos de Supabase, evitando que un navegador antiguo pueda reinyectar información previa.

## Rama

`reinicio-local-seguro`, basada en `pm02-integrado`.

## Qué elimina

En Deploy Preview se eliminan todas las claves funcionales de L&A Suite bajo:

- `almacen:*`
- `almacen__*`
- marcadores antiguos `la_suite_reset_pruebas_*`

Esto incluye empresa, locales, configuración de empresa, productos, movimientos, usuarios internos, PIN, colas pendientes, tombstones y demás estado funcional local.

## Qué conserva

No se usa `localStorage.clear()`.

Se conservan claves ajenas al espacio funcional de L&A Suite, incluida la sesión técnica de Supabase (`sb-*-auth-token`) para no romper el acceso por diseño del reset.

## Seguridad

El reset solo se activa en:

- alias `deploy-preview-N--chic-entremet-9107cf.netlify.app`
- permalink inmutable de 24 hexadecimales de Netlify Preview

No se activa en:

- `chic-entremet-9107cf.netlify.app`
- `main--chic-entremet-9107cf.netlify.app`

Además conserva la barrera de PM-02 que bloquea cualquier `fetch` al host Supabase productivo desde Preview.

## Evidencia automática

Workflow: `Validar reinicio local seguro`

Resultado:

- `REINICIO_LOCAL_TOTAL_OK=1`
- `SESION_TECNICA_CONSERVADA=1`
- `COLAS_ANTIGUAS_ELIMINADAS=1`
- `PRODUCCION_NO_AFECTADA=1`

## Limitación importante

El almacenamiento del navegador está aislado por origen. Ejecutar el reset en un Deploy Preview no puede borrar el `localStorage` ya existente del dominio de producción en los móviles u ordenadores que hayan usado L&A Suite anteriormente.

Por tanto, para dejar un dispositivo real antiguo a cero hay dos opciones futuras:

1. limpieza manual de los datos del sitio en cada dispositivo; o
2. despliegue deliberado de una migración de reinicio al dominio de producción.

La opción 2 constituye un cambio de producción y no debe ejecutarse sin autorización explícita.

## Rollback

No hay nada que revertir en producción. Basta descartar la rama/PR de pruebas.

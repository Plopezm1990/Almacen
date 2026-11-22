# Acta · paridad de estructura y organización Órbita · 22/11/2026

## Motivo

La maqueta y la suite real compartían paleta y parte del shell, pero no la
misma organización de experiencia. La maqueta agrupa el trabajo por áreas
operativas; la aplicación real seguía mostrando grupos históricos como
«Ventas», «Finanzas y análisis» y «Sistema». Esa diferencia hacía que el
producto pareciera otra aplicación aunque los datos y los permisos fueran
correctos.

## Cambio aplicado

En `fuente.js` y en su espejo
`source-recovery/fuente-recuperado.js`, la distribución de navegación cuando
el diseño activo es `orbita` pasa a ser:

| Orden | Área visible en Órbita | Grupos reales incluidos |
|---:|---|---|
| 1 | Inicio | Inicio |
| 2 | Servicio | Ventas, TPV, Cocina, Encargos y Clientes |
| 3 | Caja y fiscalidad | Cuentas por pagar, libro de IVA, arqueo y tesorería |
| 4 | Compras | Proveedores, pedidos, recepción, albaranes y facturas |
| 5 | Inventario | Almacén, producción y mermas |
| 6 | Equipo | Personal, turnos, fichajes y nóminas |
| 7 | Calidad | Control sanitario y aceite |
| 8 | Informes | Resultados, reportes y rotación, estacionalidad |
| 9 | Organización | Locales y configuración |
| 10 | Sistema | Auditoría, respaldos, notificaciones y errores del sistema |

La agrupación solo cambia el primer nivel visual. Se conservan los ids de
las pantallas, las capacidades `ABC_*`, los handlers de navegación, la
selección de empresa/local y la lógica de cada módulo. Las variantes `claro`
y `sello` mantienen sus agrupaciones específicas.

## Contratos ejecutados

```text
MARCO_ORBITA_CONTRACT=PASS (27/27)
REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS
REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12 responsive=PASS tactil=44
git diff --check = PASS
```

El contrato del marco incluye ahora una aserción de que la distribución
Órbita contiene `Servicio`, `Caja y fiscalidad`, `Compras`, `Inventario`,
`Equipo`, `Calidad`, `Informes`, `Organización` y `Sistema`, y que el espejo
de recuperación conserva exactamente la misma definición.

## Límites y siguiente evidencia

- La organización se ha corregido en la fuente de la rama
  `rediseno/f0-base-qa`; no se ha tocado producción.
- La comprobación de datos, permisos y rutas sigue siendo la del programa
  real: QA conserva `QA Empresa A, S.L.`, sus locales y sus membresías.
- Tras publicar el commit, hay que abrir el Deploy Preview 225 con una sesión
  de QA y comprobar en escritorio y móvil que los diez rótulos aparecen en el
  lateral y que la barra móvil mantiene los destinos operativos permitidos.
- Las pantallas que no son producto real o están bloqueadas por backend siguen
  clasificadas en `MATRIZ-CIERRE-VISUAL-ORBITA-2026-11-22.csv`; esta corrección
  no las inventa ni cambia su alcance.

## Estado

Implementación de la organización Órbita: **aplicada y publicada en la rama**;
la comprobación live del preview anterior sigue mostrando la versión previa
hasta que Netlify termine el despliegue del commit `fb53b58e`.

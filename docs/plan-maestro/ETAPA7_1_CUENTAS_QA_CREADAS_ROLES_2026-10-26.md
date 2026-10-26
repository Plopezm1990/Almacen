# Plan Maestro L&A Suite — Etapa 7.1 — cuentas QA creadas para matriz de roles

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Estado: `CUENTAS_QA_CREADAS; MATRIZ_VIVA_DE_ROLES_VERIFICADA`

## 1. Alcance

Con autorización expresa se crearon tres perfiles sintéticos de QA desde la
pantalla `Personal` del preview. Se utilizarán exclusivamente para comprobar
la matriz viva de permisos del TPV y Caja.

No se usaron datos de producción, no se modificó la cuenta QA existente y no
se guardaron códigos de acceso en el repositorio ni en esta acta.

## 2. Cuentas creadas

| Perfil QA | Categoría | Rol de acceso | Estado visible |
|---|---|---|---|
| `QA Cajero` | `Cajero QA` | `Cajero/a` | PIN configurado; cuenta creada |
| `QA Camarero` | `Camarero QA` | `Camarero/a` | PIN configurado; cuenta creada |
| `QA Encargado` | `Encargado QA` | `Encargado` | PIN configurado; cuenta creada |

La ficha previa existente de QA conserva su rol `Encargado` y no fue editada.
La nueva ficha `QA Encargado` se añadió exclusivamente para completar la
matriz viva.

## 3. Verificación inmediata

Después de las altas, la pantalla volvió a la lista de Personal y mostró:

- las cuentas QA visibles en el contexto actual;
- `QA Cajero` con rol `Cajero/a`;
- `QA Camarero` con rol `Camarero/a`;
- `QA Encargado` con rol `Encargado`;
- PIN configurado en las tres cuentas sintéticas;
- ningún error nuevo en la consola;
- ningún cambio en ventas, cobros, Caja, productos o permisos de negocio.

## 4. Tratamiento de credenciales

Los códigos son credenciales temporales de QA y no se incluyen en Git, en la
documentación ni en mensajes compartidos. Deben conservarse únicamente en el
canal seguro que el responsable de QA utilice para la prueba.

No se creó una cuenta de empleado con rol `Propietario` porque la propia
interfaz de alta solo ofrece `Camarero/a`, `Cajero/a`, `Encargado` y `Estándar`.
La sesión de Propietario existente sigue siendo la referencia administrativa,
no una cuarta cuenta de empleado.

## 5. Resultado del login y de la matriz viva

La prueba se ejecutó en el Deploy Preview del PR `#175`, con la sesión
administrativa QA ya abierta, sin tocar producción y sin ejecutar operaciones
de negocio:

| Cuenta | Login | TPV | Sección Caja | Resultado |
|---|---|---|---|---|
| `QA Cajero` | Correcto | Visible | Visible; aparece `Abrir caja` | PASS |
| `QA Camarero` | Correcto | Visible | No aparece la pestaña `Caja` | PASS |
| `QA Encargado` | Correcto | Visible | Visible; aparece `Abrir caja` | PASS |

En los tres casos el TPV quedó con `0 líneas · €0,00`, `0` ventas y total
`€0,00`. No se pulsó `Guardar`, no se abrió Caja, no se registró movimiento
de efectivo y no se creó ningún cobro. Al finalizar se salió del modo
empleado y el contexto volvió a mostrar `Modo empleado` sin usuario activo.

La consola del navegador quedó sin errores ni advertencias nuevas durante la
prueba. El aislamiento de empresa/local observado permaneció en `Local A2 ·
QA Empresa A, S.L.` y no se utilizó el proyecto Supabase de producción.

El perfil `QA Encargado` también se comprobó en vivo: el login fue correcto,
el TPV mostró la pestaña `Caja` y la acción `Abrir caja`, y el menú `Más`
mostró las áreas operativas permitidas para ese nivel. No se abrió Caja ni se
ejecutó ninguna acción con efecto económico.

## 6. Qué sigue

1. Mantener pendiente la comparación con una segunda empresa (B), porque el
   selector disponible en esta sesión solo expone `QA Empresa A, S.L.` y sus
   locales `Local A1` y `Local A2`.
2. Ejecutar la prueba de arranque en frío sin red.
3. Ejecutar la campaña T9 física con el hardware autorizado.

Las credenciales temporales usadas en la prueba no se documentan ni se
reutilizan en producción.

## 7. Resultado del aislamiento vivo A2 ↔ A1

Fecha de comprobación: 26/10/2026. La prueba se repitió con sesión real de
empleado `QA Encargado`, sobre el Deploy Preview del PR `#175`, sin usar el
proyecto Supabase de producción.

### 7.1 Contexto inicial en Local A2

- Cabecera: `Local A2 · QA Empresa A, S.L.`.
- Selector: `Mostrando solo Local A2`.
- TPV: zona `Local A2`, catálogo de `15 producto(s) disponible(s)`.
- Ticket: `0 línea(s) · € 0,00`.
- Historial visible: `0` ventas, total vigente `€ 0,00`.
- `F9 Guardar`: deshabilitado.

### 7.2 Cambio a Local A1

Después de cambiar el selector, la interfaz mostró de forma coherente:

- cabecera `Local A1 · QA Empresa A, S.L.`;
- `Mostrando solo Local A1`;
- indicadores propios de A1, distintos de A2 (`Saldo de almacén €12,27`,
  `Margen promedio 92,58%`, `2` encargos urgentes y `2` conteos atrasados);
- TPV en zona `Local A1`, con `18 producto(s) disponible(s)`;
- ticket vacío: `0 línea(s) · € 0,00` y `F9 Guardar` deshabilitado;
- historial de A1 separado, con `31` ventas y total vigente `€ 0,00`.

No apareció en A1 el catálogo ni el resumen propio de A2, y no se observó
fuga de contexto entre locales. Se comprobó también que las diferencias
observadas eran datos ya existentes de QA y no cambios generados por la
prueba.

### 7.3 Regreso y cierre

Se volvió a seleccionar `Local A2` y se recuperó la cabecera, el filtro y los
indicadores de A2: saldo `€0,00`, margen `100,00%`, `0` encargos urgentes y
`3` conteos atrasados. Se salió del TPV, se cerró el modo empleado y el
preview quedó de nuevo en modo Propietario con `Local A2` activo.

No se pulsó `Guardar`, no se abrió Caja, no se fichó entrada, no se abrió el
cajón, no se añadió producto al ticket, no se creó cobro y no se registró
ningún movimiento. La inspección final de consola devolvió `[]` para niveles
`error` y `warn`.

### 7.4 Límite de alcance

La sesión no mostró un selector de empresa B: el alcance funcional disponible
fue únicamente `QA Empresa A, S.L.` con `Local A1` y `Local A2`. La separación
entre empresas queda, por tanto, pendiente de una cuenta/proyecto QA que
exponga una segunda empresa. Esta prueba cierra el aislamiento entre los dos
locales de la empresa A y no debe presentarse como prueba A/B completa.

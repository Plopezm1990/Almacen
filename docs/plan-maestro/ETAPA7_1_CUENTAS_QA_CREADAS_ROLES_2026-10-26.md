# Plan Maestro L&A Suite — Etapa 7.1 — cuentas QA creadas para matriz de roles

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Estado: `CUENTAS_QA_CREADAS; LOGIN_CAJERO_Y_CAMARERO_VERIFICADO; ENCARGADO_PENDIENTE`

## 1. Alcance

Con autorización expresa se crearon dos perfiles sintéticos de QA desde la
pantalla `Personal` del preview. Se utilizarán exclusivamente para comprobar
la matriz viva de permisos del TPV y Caja.

No se usaron datos de producción, no se modificó la cuenta QA existente y no
se guardaron códigos de acceso en el repositorio ni en esta acta.

## 2. Cuentas creadas

| Perfil QA | Categoría | Rol de acceso | Estado visible |
|---|---|---|---|
| `QA Cajero` | `Cajero QA` | `Cajero/a` | PIN configurado; cuenta creada |
| `QA Camarero` | `Camarero QA` | `Camarero/a` | PIN configurado; cuenta creada |

La ficha previa existente de QA conserva su rol `Encargado` y no fue editada.

## 3. Verificación inmediata

Después de cada alta, la pantalla volvió a la lista de Personal y mostró:

- las tres fichas QA visibles en el contexto actual;
- `QA Cajero` con rol `Cajero/a`;
- `QA Camarero` con rol `Camarero/a`;
- PIN configurado en ambas cuentas nuevas;
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

En ambos casos el TPV quedó con `0 líneas · €0,00`, `0` ventas y total
`€0,00`. No se pulsó `Guardar`, no se abrió Caja, no se registró movimiento
de efectivo y no se creó ningún cobro. Al finalizar se salió del modo
empleado y el contexto volvió a mostrar `Modo empleado` sin usuario activo.

La consola del navegador quedó sin errores ni advertencias nuevas durante la
prueba. El aislamiento de empresa/local observado permaneció en `Local A2 ·
QA Empresa A, S.L.` y no se utilizó el proyecto Supabase de producción.

La prueba viva del perfil `Encargado` sigue pendiente porque la cuenta
existente tiene PIN configurado, pero su código no está disponible para esta
sesión y no se debe adivinar ni registrar. Los contratos estáticos ya
verifican la regla esperada para `Encargado`; falta únicamente la evidencia de
login real con su credencial proporcionada de forma segura.

## 6. Qué sigue

1. Ejecutar el login vivo de `Encargado` cuando el responsable introduzca su
   PIN de forma segura, verificando Caja y las acciones reservadas a ese rol.
2. Completar la comparación A/B/A1/A2 y el aislamiento entre locales con
   sesión de empleado, sin guardar operaciones.
3. Mantener pendiente la prueba de arranque en frío sin red y la campaña T9
   física; estas no quedan cubiertas por esta validación visual.

Las credenciales temporales usadas en la prueba no se documentan ni se
reutilizan en producción.

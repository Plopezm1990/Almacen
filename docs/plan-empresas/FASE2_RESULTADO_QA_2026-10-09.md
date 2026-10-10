# Fase 2 — borrado definitivo de una empresa y de todos sus datos: resultado en QA

Fecha: 9/10/2026
Estado: **APLICADA Y VERIFICADA EN QA** (`qjqorixtkilwsndqayyx`). **Producción no se ha tocado.**

Autorización de Pedro (9/10/2026): «Sí, empezar la Fase 2 en QA» y plazo de gracia de **30 días**. Sobre los datos actuales de producción dijo que no le interesan (son pruebas), así que no hace falta exportarlos antes de borrarlos; en producción se aplicará esa decisión en la fase 6, con su autorización escrita.

## Qué se ha construido
Archivo del repositorio: `supabase/migrations/20261009130000_plataforma_f2_eliminar_empresa.sql` (depende de la fase 1; no se aplica solo a producción).

| Pieza | Para qué |
|---|---|
| `private.plataforma_ajustes` | Ajustes de plataforma; `dias_gracia_borrado` = 30. Solo se cambia por SQL, nunca desde la aplicación |
| `private.plataforma_exportaciones` | Qué copias se descargaron, cuándo y con qué huella |
| `private.plataforma_codigos` | Códigos de un solo uso (guardados como huella), 15 minutos |
| `private.plataforma_eliminaciones` | **Acta de borrado**: empresa, nombre, fecha, quién, motivo de la baja, filas borradas por tabla, cuentas, huella de la copia y huella del acta. Sin contenido de negocio |
| `plataforma_resumen_eliminacion(empresa)` | Qué bloquea el borrado y qué se borraría (filas por tabla y cuentas) |
| `plataforma_exportar_empresa(op, empresa)` | La copia descargable (todas sus tablas, sus cuentas con correo y rol), con huella SHA-256 |
| `plataforma_preparar_eliminacion(op, empresa)` | Si no hay bloqueos, entrega el código de un solo uso y el resumen |
| `plataforma_eliminar_empresa(op, empresa, nombre, código, motivo_sin_copia)` | El borrado, todo o nada |
| `plataforma_desactivar_empresa` (ajustada) | Si la empresa ya estaba desactivada por otra vía y no tiene baja registrada, la registra ahora (así empieza a contar el plazo) |

## Las puertas (todas en el servidor)
1. Solo el administrador de la plataforma.
2. La empresa debe estar **desactivada** y tener una **baja vigente** registrada.
3. **Plazo de gracia**: 30 días desde la baja (ajustable solo por SQL).
4. **Copia exportada después de la baja**; si no la hay, hace falta un **motivo escrito** (mínimo 10 caracteres) que queda en el acta.
5. **Nombre exacto** de la empresa y **código de un solo uso** (el último emitido; uno nuevo invalida los anteriores; caduca a los 15 minutos).
6. La contraseña del administrador la pedirá la aplicación (fase 3) antes de llamar.

## Cómo borra
- **Descubre las tablas por el catálogo**: todas las de `public` y las internas de `private` con `empresa_id` (menos las propias de plataforma), más `suscripciones_push` (por local), `fichajes_registro` y `movimientos_registro` (por local en `datos`). Una tabla nueva con `empresa_id` entra sola.
- **Orden por claves ajenas** (hijas antes que padres). Si hay un ciclo o una clave ajena lo impide, se aborta todo.
- **Disparadores de inmutabilidad**: se desbloquean solo los cuatro conocidos (impresiones, entregas, conciliaciones y ensayos de cierre) dentro de la operación y se vuelven a activar antes de terminar. Cualquier otro bloqueo desconocido aborta el borrado entero. No se usa el modo réplica.
- **Cuentas de acceso**: se borran las que solo pertenecían a esta empresa (no las compartidas con otra, no los administradores de plataforma); primero sus perfiles (un perfil apunta a su empleado) y, tras vaciar las tablas, la cuenta en Auth.
- `almacen_kv`: se borran las filas **etiquetadas** con la empresa; las colecciones sin etiqueta (todo el almacén antiguo de producción) no son de ninguna empresa y no se tocan (se resolverán con P3).
- **Comprobación final** de que no queda ninguna fila ni la empresa ni sus cuentas; si queda algo, se deshace todo. Después se escribe el acta.
- **Cobertura**: `private.plataforma_tablas_sin_alcance()` devuelve las tablas que no se borran ni están declaradas como globales/técnicas; debe ser `[]` (hoy lo es en el esquema de prueba y en QA).

## Cómo se probó
1. **Contrato con Postgres 16** (`tests/plataforma/db/p03-eliminar-empresa-contract.mjs`, contrato activo `postgres`): permisos (dueño y anon rechazados), cada puerta por separado, plazo (29 días bloquea, 31 no), códigos (antiguo invalidado, erróneo, caducado, repetido), nombre, copia y su sustituto con motivo, borrado completo sobre cadena de claves ajenas con RESTRICT, clave ajena a sí misma, padre e hijo en orden alfabético contrario, tabla interna con clave ajena compuesta, tablas por local, inmutables, almacen_kv etiquetado y sin etiquetar, cuentas exclusivas / compartidas / de administrador, empresa vecina intacta (foto antes/después), todo o nada ante un bloqueo desconocido y ante restos «resucitados» por un disparador, acta, auditoría, idempotencia y contrato estático. **12 mutantes, los 12 detectados.**
2. **QA con datos reales**, dentro de una transacción revertida, borrando la empresa grande de QA (`QA-EMP-A`: **4.654 filas en 64 tablas, 5 cuentas exclusivas, tablas fiscales inmutables incluidas**): ninguna tabla conserva filas de la empresa (ni en `public` ni en `private`), las 5 cuentas desaparecen de Auth, `QA-EMP-B` queda idéntica, la cuenta administradora sigue existiendo y sigue siendo administradora, las colecciones sin etiqueta de `almacen_kv` pasan de 7 a 7, los cuatro disparadores de inmutabilidad quedan activos y el acta se escribe. Al terminar se revirtió todo y se comprobó que QA quedó igual.
3. **Hallazgos de esa prueba con datos reales** (que la base de pruebas local no podía mostrar) y su arreglo, con prueba que los reproduce:
   - un perfil apunta a su empleado con RESTRICT → se borran primero los perfiles de las cuentas exclusivas;
   - el esquema `private` también tiene tablas con datos de empresa (`abc_operating_day_reglas`, `abc_b07_cuentas_comerciales`) con clave ajena compuesta a `locales` → el plan incluye `private` (menos las tablas de plataforma) y `tablas_sin_alcance()` mira ambos esquemas;
   - `almacen_kv` tenía 13 filas etiquetadas con la empresa → ahora se borran.
4. **Borrado real (sin revertir) de la empresa de prueba que dejó Cowork** (`empresa-5ed41d21a3b3b7f8`), con todas las puertas y con el plazo puesto a 0 solo para este ensayo (se restauró a 30): copia exportada, código, nombre exacto → **acta nº 3** (2 filas: local y membresía; 1 cuenta). La cuenta de acceso del dueño de prueba **entraba antes (HTTP 200) y después ya no (HTTP 400, `invalid_credentials`)**.
5. Huellas md5 de las funciones nuevas o cambiadas en QA = las de la base local donde se ejecutó el archivo del repositorio.

## Cómo se aplicó en QA (trazabilidad)
En trozos pequeños (`plataforma_f2_a` … `plataforma_f2_g`): hubo que reaplicar tres veces funciones corregidas tras los hallazgos del punto 3. El contenido final equivale al archivo del repositorio (mismas huellas). En producción se aplicará el archivo único, con autorización escrita de Pedro. Antes de aplicarlo en producción hay que ejecutar allí `select private.plataforma_tablas_sin_alcance()` (solo lectura) y decidir cualquier tabla que aparezca: producción tiene tablas internas propias (`private.pm27_prod_recovery_20260914`, ya declarada como técnica) y `movimientos_registro` / `fichajes_registro` sin `empresa_id`.

## Límites conocidos
- **Producción a cero tardará el plazo de gracia** (30 días desde la baja) salvo que Pedro autorice por escrito bajarlo a 0 para los restos de pruebas actuales. Las dos empresas desactivadas de producción no tienen baja registrada: al desactivarlas con la función nueva empieza a contar el plazo.
- Los datos que viven en colecciones comunes (`almacen_kv` sin etiqueta, `movimientos_registro` y `fichajes_registro` en producción) no se pueden atribuir a una empresa y no se borran con ella; es parte del paquete P3 (aislamiento por empresa), que sigue siendo condición previa de la primera empresa cliente real.
- La copia es un único JSON devuelto por la función (válido para empresas pequeñas y medianas; para volúmenes grandes habrá que paginarla en la fase 3).
- La pantalla del panel y el flujo de contraseña de confirmación son de la fase 3.
- Aviso legal orientativo (consultar con gestor o abogado): conservación de facturas y contabilidad (en España, orientativamente 4 años a efectos tributarios y 6 mercantiles) y RGPD art. 28.3.g; por eso la copia previa y el plazo de gracia.

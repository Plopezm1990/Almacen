# Plan Maestro L&A Suite — Etapa 6, T8 (pieza 5): edición de opciones con clave de confirmación

Fecha: 25/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Pedro (chat, 25/10/2026), alcance elegido entre tres opciones: construir solo
esta parte de la pieza 5.

## 1. Lo pedido

La pieza 5 del plan junta dos ideas bajo un mismo epígrafe: *"teclas y permisos por cargo, y
edición de opciones con clave del propietario"*. Antes de construir nada se investigó y se
confirmó que no existe ninguna «tecla de función» real en el TPV todavía — es un concepto del
rediseño visual (Etapa 9), que no se ha empezado a construir — así que no hay nada que
gestionar «por cargo» en ese sentido. Se planteó el alcance a Pedro en tres niveles y eligió
el más acotado: construir solo «edición de opciones con clave de confirmación», dejando
«teclas por cargo» aparcada hasta que existan teclas reales.

## 2. Decisión de diseño explícita

El plan dice «clave del propietario», pero pedirle a quien está editando que escriba la
contraseña de **otra persona** (el propietario) sería un antipatrón de seguridad serio — nunca
se debe diseñar un formulario que pida la contraseña de alguien que no sea quien lo está
rellenando. Se ha interpretado y construido como: **la propia contraseña** de quien edita
(Propietario o Encargado, el mismo permiso que ya exige `abc_catalogo_puede_gestionar` para
gestionar el catálogo), reintroducida como una confirmación extra justo antes de guardar. El
permiso de fondo no cambia — esto es una fricción de seguridad añadida, no una restricción de
quién puede editar.

## 3. Qué se construyó

Sin ninguna migración nueva: Supabase Auth ya valida contraseñas, así que no hace falta
ninguna tabla ni función en el servidor. Cambio solo en pantalla (`fuente.js` y
`source-recovery/fuente-recuperado.js`), dentro de `ConfigOpciones` (T8 piezas 1 y 2):

- Campo nuevo **"Confirma tu contraseña (la tuya, para guardar cambios en esta biblioteca)"**,
  justo debajo de "Motivo del cambio".
- Antes de llamar al servidor para guardar un grupo, una opción o un enlace a producto (y
  también en los botones rápidos de activar/desactivar, que reutilizan las mismas funciones),
  se reautentica con `supabase.auth.signInWithPassword({ email, password })` usando el correo
  de la sesión actual y la contraseña escrita. Si falla, "Contraseña incorrecta." y no se
  guarda nada. Si acierta, sigue el guardado normal.
- La contraseña se borra del campo en cuanto se usa (antes incluso de recibir la respuesta del
  servidor), tanto si acierta como si falla — nunca queda escrita en pantalla.

## 4. Verificación

- `node --check` en ambos archivos: OK.
- Prueba de contrato (`tests/plan-maestro/etapa6-t8-clave-propietario-contract.mjs`):
  comprueba el estado y la función `confirmarClave`, que las 3 funciones de guardado la piden
  justo antes de llamar al servidor (después de validar los demás campos), que el campo se
  vacía en cuanto se usa, y la paridad carácter a carácter entre `fuente.js` y el espejo. Todo
  en verde.
- Todos los contratos existentes: sin cambios de resultado.
- Manifiesto de CI actualizado (319→320 archivos, 302→303 contratos activos, Node 272→273).
- Probado en vivo en QA (Cowork, 25/10/2026): los 7 pasos del guion, todos correctos a la
  primera — sin contraseña rechaza con el mensaje correcto, con contraseña incorrecta rechaza
  con "Contraseña incorrecta.", con la contraseña correcta guarda con normalidad, el campo se
  vacía siempre, y tanto los tres formularios (grupo, opción, enlace) como los botones rápidos
  de activar/desactivar quedan protegidos por igual.

## 5. Límites respetados

- No se ha tocado PROD.
- No se ha creado ninguna tabla ni función nueva en el servidor.
- El permiso de fondo (Propietario o Encargado) no cambia; solo se añade una confirmación.
- «Teclas por cargo» queda explícitamente fuera de esta pieza, pendiente de que existan
  teclas de función reales (Etapa 9).

**T8, piezas 1 a 5: todas construidas, probadas en QA y corregidas. Con esto, la Etapa 6 (T8)
queda cerrada en su totalidad**, salvo la parte de «teclas por cargo» que se deja aparcada a
propósito hasta el rediseño visual.

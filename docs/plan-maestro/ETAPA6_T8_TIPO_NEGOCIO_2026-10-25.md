# Plan Maestro L&A Suite — Etapa 6, T8 (pieza 4): tipo de negocio + biblioteca de ejemplo

Fecha: 25/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Pedro (chat, 24-25/10/2026), alcance elegido entre tres opciones:
"tipo + biblioteca de opciones de ejemplo".

## 1. Lo pedido

Seguir con T8 (Etapa 6) por su cuarta pieza: "plantillas por tipo de negocio". Como con la
pieza 3, se planteó el alcance en tres niveles (solo la etiqueta / etiqueta + biblioteca de
ejemplo / parar aquí) y Pedro eligió el intermedio: guardar un tipo de negocio y, si se pide,
sembrar unos grupos de opciones de ejemplo típicos de ese tipo.

## 2. Qué se construyó

Migración `20261025100000_t8_tipo_negocio_plantillas.sql`:

- `empresas.tipo_negocio` (columna nueva, nullable): Bar, Restaurante, Cafetería, Pastelería,
  Tienda u Otro. Solo una etiqueta informativa de toda la empresa; no condiciona ningún
  cálculo fiscal ni operativo.
- `abc_guardar_tipo_negocio`: guarda el tipo (exige ser Propietario de toda la empresa, igual
  que ya exige la gestión de cargos: `abc_config_puede_configurar_empresa`) y, si se pide,
  siembra en la biblioteca de opciones de este local (T8 pieza 1) unos grupos de ejemplo
  típicos de ese tipo — sin tocar ningún producto ni enlazarlos a nada. Nunca duplica: si ya
  existe un grupo con ese nombre en el local (de cualquier origen), no lo vuelve a crear.
- `abc_obtener_tipo_negocio`: cualquier miembro del local puede ver el tipo actual.

Plantillas de ejemplo (en EUR, editables o borrables libremente después):
- **Bar:** grupo «Hielo» (Con hielo / Sin hielo).
- **Restaurante:** grupo «Punto de la carne» (Poco hecho / Al punto / Muy hecho).
- **Cafetería:** grupos «Tamaño» (Pequeño/Mediano/Grande) y «Tipo de leche»
  (Entera/Desnatada/Sin lactosa/Avena).
- **Pastelería:** grupo «Relleno» (Nata/Chocolate/Fruta).
- **Tienda:** grupo «Talla» (S/M/L/XL).
- **Otro:** no siembra nada.

### Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

Pestaña nueva **"Tipo de negocio"** en Configuración: elegir el tipo, marcar si se quiere
sembrar la biblioteca de ejemplo, motivo y guardar.

## 3. Hallazgos en la prueba en vivo (Cowork) y corrección

Los 8 pasos de la prueba salieron bien funcionalmente: tipo guardado y mostrado correctamente,
siembra de ejemplo, sin duplicados al repetir, "Otro" sin ejemplos, y rechazo correcto sin
motivo.

Dos hallazgos reales, corregidos en el mismo turno (migración
`20261025110000_t8_tipo_negocio_fix_omitidos.sql`, sin tocar la ya aplicada):

1. En el local de prueba ya existía un grupo «Tamaño» de una sesión anterior; al sembrar
   Cafetería, ese grupo se omitió correctamente (nunca duplica), pero el mensaje solo decía
   «se añadieron 1 grupo(s)» sin explicar qué se había omitido ni por qué — daba la impresión
   de que faltaba algo. **Corregido:** `abc_guardar_tipo_negocio` ahora también devuelve
   `grupos_ejemplo_omitidos`, y el mensaje de la pantalla lo explica: *"No se tocó el grupo
   «Tamaño» porque ya existía con ese nombre en este local."*
2. Al elegir «Otro», la casilla de biblioteca de ejemplo se deshabilitaba en pantalla pero
   seguía marcada por dentro. El servidor ya la ignoraba siempre (Otro nunca siembra nada),
   así que no era un fallo de seguridad ni de datos, pero sí ambiguo de ver. **Corregido:** al
   elegir «Otro» la casilla se desmarca de verdad.

## 4. Verificación

- `node --check` en ambos archivos: OK.
- Prueba de contrato (`tests/plan-maestro/etapa6-t8-tipo-negocio-contract.mjs`): comprueba la
  columna, las 2 RPCs (permiso, idempotencia, limpieza ante fallo), que la siembra nunca
  duplique, las 5 plantillas, los dos hallazgos corregidos y la paridad carácter a carácter
  entre `fuente.js` y el espejo. Todo en verde.
- Todos los contratos de `tests/plan-maestro/`: sin cambios de resultado.
- Manifiesto de CI: sin cambios de contadores (no se añadió ningún archivo de test nuevo en
  la corrección).
- Probado en vivo en QA (Cowork, 25/10/2026): los 8 pasos, con los dos ajustes aplicados
  después.

## 5. Límites respetados

- No se ha tocado PROD.
- No se ha creado ninguna tabla nueva: columna aditiva en `empresas`, reutiliza el esquema de
  T8 pieza 1 para la biblioteca de ejemplo.
- No se ha tocado ningún producto ni ningún enlace existente.

**T8, piezas 1 a 4: construidas, probadas en QA y corregidas. Pieza 5 (teclas y permisos por
cargo) es la última que queda de T8.**

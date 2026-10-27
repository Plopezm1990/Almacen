# C07 · Prueba de aislamiento fiscal multiempresa en QA

Fecha: 27/10/2026  
Entorno: QA (`qjqorixtkilwsndqayyx`)  
Producción: no modificada.

## Alcance

Se comprobó el aislamiento entre dos empresas activas de QA, con propietarios
distintos y emisores fiscales simulados ya existentes:

- `QA-EMP-A` / `QA-A1` / emisor `QA Fiscal A2`.
- `QA-EMP-B` / `QA-B1` / emisor `QA Fiscal B · Contexto TPV simulado`.

Se evitaron las cuentas con pertenencia a las dos empresas. La parte visual de
catálogo se realizó con las cuentas de prueba de `QA F4 Cliente 1` y
`QA F4 Cliente 2`, que son cuentas independientes.

## Resultado de la prueba visual de aislamiento

En una vista previa de QA con origen limpio:

1. La cuenta de `QA F4 Cliente 1` entró en `Local F4-1` y vio únicamente
   `Café F4-1` y `Café F4-3`.
2. Se cerró la sesión y se entró con la cuenta de `QA F4 Cliente 2`.
3. La segunda cuenta entró en `Local F4-2` y vio únicamente `Harina F4-2b` y
   `Harina F4-3`.
4. No apareció ningún producto de la otra empresa.

Resultado: **PASS — el aislamiento visual por empresa funciona en QA**.

## Resultado de la prueba fiscal C07

Las RPC se ejecutaron contra QA con el rol `authenticated` y el `sub` real de
cada propietario, usando una transacción que se revirtió al finalizar. No se
dejaron datos nuevos.

- Propietario de `QA-EMP-A`: el listado devolvió solo el emisor de A y el
  borrador devolvió `empresa_id = QA-EMP-A`, versión `0`, estado `BORRADOR`,
  conexión `NO_CONFIGURADA` y emisión deshabilitada.
- Propietario de `QA-EMP-B`: el listado devolvió solo el emisor de B y el
  borrador devolvió `empresa_id = QA-EMP-B`, versión `0`, estado `BORRADOR`,
  conexión `NO_CONFIGURADA` y emisión deshabilitada.
- A intentando leer el emisor/borrador de B: rechazado con
  `FISCAL_CONFIG_NO_AUTORIZADO`.
- B intentando leer el emisor/borrador de A: rechazado con
  `FISCAL_CONFIG_NO_AUTORIZADO`.
- Guardado de borrador de A y B con operaciones únicas: ambos devolvieron
  versión `1`, sin activar conexión ni emisión. La transacción se revirtió.
- Comprobación posterior: ambos siguen con `0` borradores persistidos y versión
  máxima `0`.

Resultado: **PASS — aislamiento y guardado controlado de C07 en QA**.

## Comprobación visual del frontend C07

Se reutilizó la vista previa conservada del PR #180:

`https://deploy-preview-180--chic-entremet-9107cf.netlify.app/?qa=c07-visual`

La vista previa conecta con QA y contiene el frontend C07 actualizado.

- Con la cuenta de `QA F4 Cliente 1`, el menú `Más → Configuración` mostró el
  botón `Fiscalidad y AEAT`. El panel mostró `Local F4-1` y avisó correctamente
  de que no hay un emisor vinculado en esa empresa de prueba.
- Tras cerrar sesión y entrar con la cuenta de `QA F4 Cliente 2`, el mismo panel
  mostró `Local F4-2` y el aviso correspondiente a esa segunda empresa.
- No se arrastró el nombre del local ni información fiscal de la primera cuenta
  a la segunda.
- El panel mostró expresamente que se trata de una configuración en borrador,
  que no envía datos a la AEAT, que no admite certificados o claves privadas y
  que la emisión está deshabilitada.

Resultado: **PASS — el frontend C07 está disponible en la vista previa QA y
respeta el cambio de contexto entre las dos empresas**.

## Creación del fixture fiscal QA y prueba visual completa

Para cerrar la limitación anterior se crearon dos entidades fiscales simuladas,
solo en QA, y se vincularon a los locales de las empresas de prueba:

- `C07 QA Fiscal Empresa 1`, identificador `C07-QA-A`, para `QA F4 Cliente 1`.
- `C07 QA Fiscal Empresa 2`, identificador `C07-QA-B`, para `QA F4 Cliente 2`.

Ambas quedaron marcadas como simuladas y activas. No representan una empresa
real, no contienen certificado ni clave privada y nunca pueden activar emisión
real.

Con la empresa 2 se verificó además la validación del formulario:

1. Se intentó guardar un NIF de presentador inválido y la pantalla lo rechazó
   con el mensaje `El NIF del presentador debe tener nueve caracteres
   alfanuméricos.`
2. Se corrigió el valor y el borrador se guardó en versión `1`.
3. La pantalla confirmó: `Borrador fiscal guardado. No se ha activado ninguna
   conexión ni envío a la AEAT.`

Con la empresa 1 se guardó un borrador distinto, con asesoría y colaboración
social, también en versión `1`.

Finalmente se cerró sesión, se volvió a entrar como empresa 2 y se comprobó que
se recuperaban únicamente sus propios valores: `QA C07 Fiscal Simulado B`,
España · AEAT, sujeta al RRSIF, VeriFactu y `B12345678`. No apareció ningún
valor de la empresa 1.

Resultado adicional: **PASS — formulario, validación, persistencia y separación
visual de los borradores fiscales de A y B**.

## Estado y siguiente paso

Estado de esta prueba: **TERMINADA — PASS completo para configuración fiscal
multiempresa en QA**.

La emisión real, el QR fiscal real y la conexión con la AEAT siguen fuera de
este cierre porque requieren definición legal, proveedor o vía técnica válida,
datos fiscales reales y revisión específica. El sistema continúa correctamente
con la emisión deshabilitada.

Siguiente paso: mantener estos emisores como fixtures de QA para regresión y
pasar a la siguiente tarea del plan; no promocionar estos datos simulados a
producción.

# F5 C03 · Arqueo de sesión calculado en el servidor

Fecha: 2026-10-05  
Estado: `QA_VALIDADO_PRODUCCION_PENDIENTE`

## Alcance

El cierre C04 ya calculaba `expected_amount` en el servidor al confirmar el
conteo y al finalizar. C03 añade
`abc_previsualizar_arqueo_caja(empresa,local,sesion,terminal,moneda)`, una
lectura sin efectos que muestra antes del conteo de dónde sale esa cifra:

`fondo_inicial + entradas_efectivo - salidas_efectivo = expected_amount`

Solo suma `caja_operaciones` de la empresa, local, sesión y moneda indicados.
El fondo de apertura ya es una operación de caja y no se vuelve a sumar. La
función exige sesión autenticada, capacidad `ABC_CAJA_OPERAR`, una sesión
operativa y el terminal vinculado. `anon` y `service_role` no tienen
`EXECUTE`. La pantalla muestra el desglose en `EN_CIERRE` y espera esa
lectura antes de habilitar «Confirmar cierre provisional». C04 vuelve a
calcular el esperado al confirmar, de modo que la vista previa no congela el
saldo ni acepta un esperado enviado por el navegador.

## Evidencia en QA

- La migración `20261005160403_abc_f5_c03_arqueo_sesion.sql` se aplicó en
  `L&A Suite QA` el 5/10; no se aplicó en producción.
- En una transacción que terminó con `ROLLBACK`, fondo 100 €, entrada 50 € y
  salida 30 € devolvieron esperado **120 €**, con los tres componentes
  correctos. Después quedaron **cero** operaciones de prueba.
- Una sesión activa de QA con dos efectos opuestos de 3,85 € devolvió
  esperado 0 € sin cambiar el ledger.
- Un terminal de otra sesión recibió `terminal_no_vinculado_sesion`; una
  identidad sin capacidad recibió `abc_caja_no_autorizado`.
- Los permisos quedaron `authenticated=true`, `anon=false` y
  `service_role=false`. El advisor de seguridad conserva los avisos
  generales conocidos: 24 tablas sin política RLS, funciones
  `SECURITY DEFINER` ejecutables por usuarios autenticados y protección de
  contraseñas filtradas desactivada. La nueva función figura dentro de ese
  inventario y se revisó específicamente su autorización y alcance.
- El contrato C03, la paridad entre fuente recuperada y bundle y la prueba de
  pantalla simulada pasan localmente. Esta última cubre recuperación del
  arqueo tras recargar y bloqueo del provisional cuando falta la lectura.
- En la vista previa del PR #122, con el perfil **Propietario QA** en el local
  A1, la pantalla mostró antes de confirmar: fondo 0 €, entradas 3,85 €,
  salidas 3,85 € y esperado 0 €. Al contar 1 €, el cierre provisional
  volvió a calcular esperado 0 € y diferencia 1 €; impidió finalizar hasta
  registrar un motivo y obtener la aprobación del Propietario. Tras ambas
  acciones permitió finalizar y el servidor confirmó el cierre definitivo.
  Se abrió una nueva sesión de QA con fondo 0 € para dejar el terminal
  operativo. El motivo y la aprobación quedaron identificados expresamente
  como prueba de QA en la auditoría.
- Ensayo adicional de punta a punta en la misma vista previa, con autorización
  expresa del usuario: se creó en el TPV de A1 una cuenta de Barra
  (`008d8ab3-2e8b-461e-be0f-c59586d9cb3a`) y un pedido
  (`331a26a4-061f-4bf9-9deb-9eb50206d73b`) de una unidad de
  «Agua 50 cl (QA)» por 1 €. El pedido pasó por ENVIADO, EN_PREPARACION,
  PREPARADO y SERVIDO. F4 confirmó un cobro en efectivo de 1 €, con 0 €
  pendiente y 0 € de cambio; la cuenta quedó PAGADO.
- En la sesión de caja de A1, «Iniciar cierre» mostró el cálculo servidor
  **fondo 0 € + entradas 1 € − salidas 0 € = esperado 1 €**. Se contó 1 €:
  el cierre provisional registró esperado 1 € y diferencia 0 €. El cierre
  definitivo se completó y se abrió otra sesión con fondo 0 €, verificada
  en estado ABIERTA. No se usó tarjeta ni pasarela real.
- El PR #122 pasó su puerta final de CI, incluido el contrato C03, los
  contratos históricos y las pruebas Node/Postgres.

## Límites y promoción

El arqueo histórico PM08/PM09 sigue separado: su pantalla envía
`p_efectivo_base` y algunas entradas antiguas no tienen ledger servidor
completo. C03 aquí cubre el **cierre por sesión ABC**, no declara resuelta esa
deriva ni sustituye el paquete independiente PM09. Durante el ensayo adicional,
la pantalla histórica «Arqueo de caja» mostró esperado 0 € mientras el cierre
por sesión ABC mostró 1 €; la conciliación de ambas vistas queda pendiente
del trabajo PM09.

Antes de producción: integrar y revisar la rama, repetir las comprobaciones
previas, conservar copia de seguridad y aplicar la migración antes de publicar
el cliente. La aceptación del cierre completo en QA por pantalla ya consta
arriba. No se ha modificado producción ni se ha fusionado o desplegado esta
rama en producción.

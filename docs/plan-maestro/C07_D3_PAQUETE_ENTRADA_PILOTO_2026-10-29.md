# C07-D.3 — Paquete de entrada del piloto sandbox

Fecha: 29/10/2026  
Estado: **PREPARADO — PENDIENTE DE EMPRESA REAL, SANDBOX EXTERNO Y HARDWARE**  
Entorno: QA/documentación  
Producción: sin cambios  

## 1. Propósito

Este documento es la hoja de entrada para iniciar el primer piloto fiscal de una
empresa real. No crea una empresa, no crea un expediente ficticio, no activa
emisión fiscal y no contiene secretos. Solo define qué datos no sensibles y qué
evidencias deben estar disponibles antes de pasar a `READY_FOR_SANDBOX`.

El piloto debe ser independiente para cada empresa, local, entidad fiscal,
serie, asesoría y adaptador. No se heredan credenciales, snapshots, series ni
resultados de QA o de otra empresa.

## 2. Datos que debe aportar el propietario

Se deben aportar inicialmente solo identificadores no secretos:

| Dato | Valor | Obligatorio |
| --- | --- | --- |
| Empresa seleccionada | `PENDIENTE` | Sí |
| `empresa_id` de la Suite | `PENDIENTE` | Sí |
| Razón social confirmada | `PENDIENTE` | Sí |
| NIF confirmado por responsable fiscal/asesoría | `PENDIENTE` | Sí |
| Local inicial | `PENDIENTE` | Sí |
| `local_id` de la Suite | `PENDIENTE` | Sí |
| Entidad fiscal emisora | `PENDIENTE` | Sí |
| Modalidad y territorio | `PENDIENTE` | Sí |
| Serie y regla de numeración | `PENDIENTE` | Sí |
| Vía de presentación | `DIRECTA / ASESORÍA / PROVEEDOR` | Sí |
| Asesoría o representante | `PENDIENTE` | Si aplica |
| Proveedor/adaptador elegido | `PENDIENTE` | Sí |
| Entorno externo | `SANDBOX` | Sí |
| Impresora y ancho de rollo | `PENDIENTE` | Para prueba física |
| Dispositivo de escaneo | `PENDIENTE` | Para prueba física |

No se deben enviar en el chat contraseñas, certificados, claves privadas,
tokens, PEM, secretos de proveedor ni credenciales de AEAT.

## 3. Checklist de entrada

El expediente no puede avanzar mientras alguno de estos controles obligatorios
esté pendiente:

- [ ] Empresa real identificada y autorizada.
- [ ] Razón social y NIF verificados.
- [ ] Local y entidad fiscal emisora delimitados.
- [ ] Territorio, modalidad y régimen revisados.
- [ ] Serie inicial y autoridad de numeración aprobadas.
- [ ] Vía de presentación elegida: directa, asesoría o proveedor.
- [ ] Representación o colaboración documentada cuando intervenga asesoría.
- [ ] Adaptador y proveedor sandbox elegidos.
- [ ] Contrato/documentación técnica del sandbox disponible.
- [ ] Resultado externo esperado definido.
- [ ] Referencia opaca de credencial disponible por canal server-side cuando sea necesaria.
- [ ] Hardware disponible para pantalla, PDF, impresión y lectura.
- [ ] Responsable de cotejo designado.
- [ ] Propietario y asesoría aceptan realizar únicamente pruebas sandbox.

## 4. Evidencias que deben conservarse

El expediente final debe guardar metadatos, referencias opacas, fechas, huellas y
resultados; nunca secretos crudos. La matriz mínima es:

| Evidencia | Resultado esperado |
| --- | --- |
| Identidad y representación | Verificadas |
| Configuración de empresa/local/emisor | Aislada y vigente |
| Serie y número | Resueltos por servidor |
| Adaptador y versión | Declarados e inmutables para la prueba |
| Solicitud sandbox | Con `idempotency_key` estable |
| Respuesta externa | Normalizada y cotejada |
| Snapshot fiscal | Inmutable y con hash/cadena |
| Ticket en pantalla | Coincide con el snapshot |
| PDF/salida imprimible | Completo, sin cortes y con el QR correspondiente |
| Ticket físico | Contraste, tamaño y zona de silencio aceptables |
| Lectura QR | Coincide con los datos del snapshot |
| Reintento/timeout/UNKNOWN | Probados sin duplicar documento |
| Revisión propietario/asesoría | Aprobada o devuelta con incidencia |
| Decisión de salida | Continuar a revisión o detener piloto |

## 5. Puertas de estado

La transición se hará exclusivamente mediante las comprobaciones server-side del
expediente:

```text
PENDIENTE_EMPRESA
  → EXPEDIENTE_EN_REVISION
  → READY_FOR_SANDBOX
  → SANDBOX_EN_CURSO
  → SANDBOX_PASS
  → PILOTO_CERRADO
```

Los bloqueos que deben conservarse de forma explícita son:

- `PILOTO_SIN_EMPRESA_REAL`
- `PILOTO_IDENTIDAD_NO_VERIFICADA`
- `PILOTO_REPRESENTACION_NO_ACREDITADA`
- `PILOTO_ADAPTADOR_NO_ELEGIDO`
- `PILOTO_SANDBOX_NO_COTEJADO`
- `PILOTO_QR_NO_COTEJADO`
- `PILOTO_HARDWARE_NO_PROBADO`
- `PILOTO_DOBLE_REVISION_PENDIENTE`

`PRODUCTION_ENABLED` no pertenece a esta transición. Si el piloto termina con
`SANDBOX_PASS`, la activación productiva requiere una revisión separada y doble
aprobación.

## 6. Estado actual del paquete

El paquete está listo para recibir una primera empresa, pero actualmente no se
puede rellenar sin inventar datos. Por ello el estado correcto sigue siendo:

```text
PENDIENTE_EMPRESA
```

QA mantiene `SIMULADOR_C07D`, transporte `DISABLED` y emisión real desactivada.
No se ha creado un expediente ficticio y no se ha modificado Supabase de
producción.

## 7. Entrada mínima para continuar

Cuando exista una empresa piloto, el siguiente mensaje debe contener únicamente:

1. nombre de la empresa seleccionada;
2. `empresa_id` y `local_id` si ya existen en la Suite;
3. vía elegida: directa, asesoría o proveedor;
4. nombre del proveedor/adaptador sandbox;
5. confirmación de que existe asesoría o responsable fiscal;
6. confirmación de que existe impresora y dispositivo para escanear.

Los datos sensibles se introducirán después mediante el canal server-side
correspondiente, nunca en frontend, fixtures, commits, logs ni en este documento.

## 8. Siguiente acción técnica

Con la entrada mínima validada, se podrá crear el expediente real mediante la RPC
autenticada de C07-D.3, comprobar las evidencias y decidir si avanza a
`EXPEDIENTE_EN_REVISION`. Hasta entonces no se cambia ningún estado del piloto.

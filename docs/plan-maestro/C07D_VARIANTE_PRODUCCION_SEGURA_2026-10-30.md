# C07-D — variante segura para producción — 2026-10-30

## Decisión de diseño

La variante de producción se prepara como **infraestructura fiscal disponible, pero emisión
real todavía desactivada**. No se copiará la configuración `SIMULADOR_C07D`, no se
promoverán fixtures de QA y no se crearán documentos fiscales productivos sin una empresa
real y un adaptador autorizado.

Esta separación evita dos errores graves:

1. interpretar que tener las tablas y las RPC equivale a estar conectado con la AEAT;
2. generar documentos con numeración, hash o QR que parezcan fiscales cuando todavía son
   pruebas internas.

## Alcance de la variante

### Incluido en la infraestructura

- Reconciliación estructural C05 por entidad fiscal.
- Tablas C07-D de registros, cadena y cola.
- Claves foráneas e índices necesarios.
- RLS y permisos únicamente a través de RPC autenticadas.
- Catálogo de adaptadores fiscales sin credenciales ni endpoints editables.
- Configuración privada por empresa, local, entidad fiscal y serie.
- Historial inmutable de revisiones de configuración.
- RPC de lectura de estado y preflight.
- Expediente de piloto sandbox sin datos secretos.

### Excluido de producción en esta fase

- Fixtures `abc_p3c_qa_b_fiscal_fixture` y `abc_p18_qa_fiscal_qr_ticket`.
- Empresa `QA-EMP-A`.
- Entidad fiscal simulada de QA.
- Adaptador `SIMULADOR_C07D`.
- Registros C07-D de QA.
- Elementos de cola de QA.
- Credenciales, certificados, tokens o claves privadas.
- Transporte AEAT.
- Estado `ACTIVA` para una empresa ficticia.
- Emisión fiscal real.

## Reglas obligatorias de la variante

### 1. Transporte cerrado

El transporte permanecerá `DISABLED` hasta que exista un adaptador de producción aprobado.
La ausencia de transporte no se resolverá poniendo una URL ficticia ni colocando secretos en
la tabla de configuración.

### 2. Configuración cerrada por defecto

La producción podrá contener el esquema y las RPC, pero no tendrá ninguna fila de
configuración de emisión activa. La configuración solo podrá pasar a `VALIDADA` o `ACTIVA`
después de que el servidor compruebe empresa, local, entidad fiscal, serie, adaptador,
entorno y representación autorizada.

### 3. Emisión bloqueada antes de mutar C05

La RPC de emisión debe resolver y validar toda la configuración antes de reservar número,
crear documento C05 o insertar el registro C07-D. Si no existe configuración válida, debe
fallar cerrado con un código de configuración ausente o transporte no disponible.

### 4. Sin secretos en la base de datos funcional

La configuración solo podrá contener una referencia opaca a un secreto server-side. Nunca
debe guardar `password`, `token`, `client_secret`, certificado, PEM, clave privada, endpoint
ni el contenido de una credencial.

### 5. Trazabilidad multiempresa

Toda fila y toda RPC debe quedar ligada a `empresa_id`, `local_id` y `entidad_fiscal_id`.
Una empresa no puede leer ni modificar la configuración de otra. La representación de una
asesoría debe conservar su historial y exigir las aprobaciones previstas.

### 6. QR no fiscal hasta activación

El QR de la interfaz solo podrá llamarse fiscal cuando exista un documento C07-D real y un
adaptador autorizado. Mientras la emisión esté desactivada, el TPV debe mostrar claramente
que se trata de un recibo interno o de una prueba no fiscal.

## Orden técnico de preparación

La variante se debe construir en este orden:

1. Preflight de C05 en la base destino.
2. Esquema C07-D y cadena fiscal.
3. Índices y claves foráneas.
4. Configuración privada y catálogo de adaptadores.
5. RPC autenticadas de lectura y preflight.
6. RPC de emisión con bloqueo de transporte.
7. Expediente de piloto sandbox.
8. Contratos de RLS, secretos, idempotencia y doble aprobación.
9. Smoke test con configuración ausente: debe quedar bloqueado sin mutar C05/C07-D.
10. Revisión humana antes de cualquier aplicación en producción.

El expediente D3 se ejecutará después de las piezas D2 aunque su nombre de archivo local
tenga un timestamp anterior; QA ya demuestra ese orden de dependencia.

## Resultado de la revisión del código actual

Las migraciones actuales contienen marcadores `QA-only` en cuatro piezas. El manifest seco
las detecta y deja la puerta en:

```text
C07D_PRODUCTION_PROMOTION=BLOCKED_UNTIL_PRODUCTION_VARIANT
```

Esto es correcto. No se deben eliminar los marcadores mecánicamente: la función de emisión
actual devuelve explícitamente `qa_only=true` y transporte `DISABLED`, por lo que necesita
una revisión de contrato antes de convertirse en una función de infraestructura productiva.

## Criterios de aceptación

La variante no podrá considerarse lista hasta que se cumpla todo lo siguiente:

- La base destino tiene el esquema C07-D completo.
- No se han copiado filas de QA.
- No existe un adaptador productivo activo por defecto.
- El preflight sin configuración bloquea antes de mutar C05.
- RLS y grants pasan la auditoría.
- No hay secretos en tablas, fixtures, bundle, commits o logs.
- El QR se etiqueta como no fiscal mientras no haya documento real.
- La cola fiscal no se presenta como transmitida a AEAT si el transporte está desactivado.
- Existe un procedimiento de rollback/reversión aprobado.
- La empresa piloto y su asesoría han aprobado los datos y el alcance.

## Estado

- Diseño de variante segura: **PREPARADO**.
- Manifest de promoción: **PREPARADO**.
- Preflight SQL de destino, solo lectura: **PREPARADO Y EJECUTADO EN QA/PRODUCCIÓN**.
- Contrato estático de solo lectura del preflight: **PASS**.
- Contrato del manifest: **PASS**.
- Migraciones aplicadas en producción: **NO**.
- Configuración fiscal real: **NO**.
- Transporte AEAT: **DESACTIVADO**.
- Siguiente puerta: crear y revisar la variante SQL productiva en una rama separada,
  ejecutando primero sus contratos en un entorno no productivo.


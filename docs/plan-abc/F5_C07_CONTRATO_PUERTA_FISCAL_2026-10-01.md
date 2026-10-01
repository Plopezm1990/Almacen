# F5 C07 Contrato de puerta fiscal

Fecha: 2026-10-01  
Estado: `CANDIDATO_C07_VALIDADO_PG_NO_APLICADO`

## Alcance

C07 deja configurable por empresa y local la modalidad fiscal y la autoridad
emisora. Permite preparar un modo `SIMULADOR` para probar el recorrido sin
proveedor, pero bloquea la activación productiva hasta que exista decisión de
asesoría, emisor y proveedor.

La configuración registra territorio, emisor interno o proveedor fiscal,
modalidad, versión, estado, responsable y configuración técnica. Las
evaluaciones quedan vinculadas al documento clasificado de C06 y conservan sus
bloqueos.

## Reglas de seguridad

- Solo una configuración vigente por empresa/local.
- `ACTIVO` no se puede establecer mediante la RPC candidata; falla con
  `c07_activacion_requiere_validacion_asesoria`.
- Un proveedor fiscal requiere identificador de proveedor.
- El modo simulador solo acepta modalidades de simulación.
- Evaluar sin configuración, con asesoría pendiente o en modo productivo sin
  activación devuelve bloqueo y no genera emisión fiscal.
- Las tablas son privadas para el cliente y las RPC requieren autenticación y
  capacidad de emisor.

## Límites explícitos

Este paquete no elige el régimen legal, no valida SIF/Veri*Factu, no genera
huellas ni QR válidos, no envía facturas, no firma, no conecta un proveedor y
no acredita cumplimiento ante AEAT. Es la puerta técnica para que esas
decisiones se incorporen en C07/C08 con asesoría y evidencia del proveedor.

## Evidencia y pendiente

La prueba PostgreSQL 16 comprobó configuración simulada, evaluación
positiva en simulador, bloqueo en productivo, rechazo de activación y requisito
de proveedor. El run 2 del workflow C07 pasó en 31 segundos. Después quedan pendientes asesoría, proveedor/sandbox, advisors
y decisión de aplicación en QA. No se aplican migraciones remotas ni se hace
deploy de Netlify.

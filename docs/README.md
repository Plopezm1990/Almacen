# Índice de documentación del repositorio

Fecha de clasificación: 2026-11-08

Este índice evita confundir una evidencia histórica con una instrucción operativa vigente. Los documentos fechados describen el estado del repositorio, QA o producción en la fecha indicada; no se deben interpretar como una fotografía actual sin comprobar primero la rama `release`, GitHub Actions y el estado real del entorno.

## Paquetes operativos vigentes

Para el trabajo actual del plan, empezar por estos documentos:

- `plan-maestro/PREPARACION_PROMOCION_C07D_2026-10-30.md`: paquete de preparación de C07-D.
- `plan-maestro/C07_D3_PAQUETE_ENTRADA_PILOTO_2026-10-29.md`: entrada de empresa piloto, sandbox y hardware.
- `plan-maestro/C07_D3_PILOTO_SANDBOX_EMPRESA_2026-10-27.md`: contrato y controles del piloto.
- `plan-maestro/C07_D2_5_CONTRATO_ADAPTADOR_SANDBOX_2026-10-27.md`: límites del adaptador externo.
- `plan-maestro/C07_D2_6_EXPEDIENTE_ACTIVACION_EMPRESA_2026-10-27.md`: expediente de activación por empresa.
- `plan-maestro/C07_D2_7_VALIDACION_VISUAL_TICKET_HARDWARE_2026-10-27.md`: validación visual y hardware pendiente.
- `plan-maestro/C07_D_PREFLIGHT_SOLO_LECTURA.sql`: preflight de solo lectura.
- `plan-maestro/PUNTO10_PROMOCION_A10_PRODUCCION_PREPARACION_2026-10-29.md`: preparación A10; mantiene el NO-GO para aplicación automática.
- `plan-maestro/PUNTO10_PROMOCION_A10_PRODUCCION_PREFLIGHT_2026-10-29.sql`: consultas de preflight A10.

Estos documentos preparan o describen controles. Ninguno autoriza por sí solo una migración productiva, una venta real, la activación de fiscalidad real o un despliegue.

## Evidencia histórica conservada

`plan-abc/`, `plan-empresas/` y el resto de `plan-maestro/` contienen informes, guiones de QA, diagnósticos y actas fechados. Se conservan porque documentan decisiones, resultados, hashes, límites y rollback; aunque mencionen ramas o PR antiguos, esas referencias son parte de la auditoría y no una orden pendiente.

En particular, los archivos cuyo nombre contiene `PROMPT`, `DIAGNOSTICO`, `EVIDENCIA`, `RESULTADO`, `CIERRE` o `AUDITORIA` no deben eliminarse automáticamente: antes hay que comprobar si otro informe los cita. Los guiones de Cowork y los diagnósticos de PM17 tienen referencias cruzadas activas.

## Regla de mantenimiento

1. Las nuevas decisiones operativas se documentan en un archivo fechado y se enlazan desde este índice o desde el paquete del punto correspondiente.
2. Una evidencia histórica no se reescribe para reflejar el estado actual; se añade una nueva evidencia fechada.
3. Un documento solo se puede retirar cuando no tenga referencias, no contenga evidencia única y exista un reemplazo explícito. La retirada debe quedar registrada en el commit de limpieza.
4. Antes de cualquier acción productiva, prevalecen el preflight vigente, la autorización explícita y el resultado de los checks remotos sobre cualquier documento antiguo.


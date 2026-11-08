# Etapa 5 — validación del QR simulado en QA

Fecha de cierre: 30/10/2026  
Entorno: QA, preview `deploy-preview-192--chic-entremet-9107cf.netlify.app`  
Producción: no modificada.  
AEAT real: desactivada.

## Ticket utilizado

- Referencia visual: `V-20261030-08868A`.
- Número de TPV: `TPV-000020`.
- Operación: `40fabcb2-223c-4a5e-87c5-c83b4c1d3207`.
- Producto: `Agua 50 cl (QA)`.
- Importe: `1,00 €`.
- Medio: efectivo.
- Fecha del payload: `30-10-2026`.

## Payload comprobado

La interfaz muestra la siguiente URL dentro del ticket y junto a la matriz:

```text
https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=QA-A2-TEST&numserie=TPV-000020&fecha=30-10-2026&importe=1.00
```

La URL contiene los cuatro datos esperados:

| Campo | Valor comprobado |
|---|---|
| NIF de prueba | `QA-A2-TEST` |
| Número de serie | `TPV-000020` |
| Fecha | `30-10-2026` |
| Importe | `1.00` |

La matriz QR aparece visible en el ticket y está rotulada como:

```text
QR tributario:
VERI*FACTU · QA · EMISIÓN REAL DESACTIVADA
```

## Resultado

**Etapa 5 terminada en QA.**

La matriz es una representación local y determinista del payload QA. Su
contenido coincide con la URL que se muestra en pantalla y con el importe,
fecha y número de TPV de la venta cobrada.

Si un lector móvil abre la URL y la Agencia Tributaria responde `No
encontrada`, ese resultado es esperado para esta etapa: QA no ha remitido una
factura real a la AEAT y la URL utiliza datos de prueba. La comprobación de
esta etapa no convierte el documento en fiscal ni confirma una presentación
real.

## Evidencia automática

```text
QR_MATRIX_CONTRACT: 4/4 PASS
AEAT_QR_CONTRACT: 7/7 PASS
QR_TICKET_PREVIEW: 2/2 PASS
git diff --check: PASS
```

La validación cubre la generación determinista de la matriz, zona de silencio,
payload largo, bits BCH, URL con los cuatro parámetros, normalización del NIF,
importe decimal, rechazo de datos inválidos y bloqueo de payloads de
producción.

## Siguiente paso

**Etapa 6 — comprobar que QA y producción tienen el mismo código frontend.**
La comparación debe centrarse en el commit y en los artefactos desplegados,
sin promover C07-D ni habilitar fiscalidad real en producción.

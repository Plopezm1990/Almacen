# PM11 · Compra, recepción y pago E2E · P05 — Factura e identidad financiera

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
P04: albarán y trazabilidad documental cerrado  
Producción/main: **NO TOCAR**

## Objetivo

Cerrar la frontera entre el hecho logístico y la obligación financiera:

`albarán confirmado` **no equivale** a `factura`.

P05 exige que una factura procedente de albarán sea explícita, tenga identidad financiera válida y no pueda crear una segunda obligación por ambigüedad, duplicación documental o acceso al flujo de pago desde un albarán simple.

## Hallazgos reales

La implementación heredada conservaba una ambigüedad peligrosa:

- varias altas de albarán nacían con `esFactura: true` por defecto;
- las vistas financieras usaban `esFactura !== false`, por lo que `undefined/null` legado también se interpretaba como factura;
- `numeroFactura` podía quedar vacío y la interfaz/flujo financiero hacía fallback al número de albarán;
- `marcarPagada` comprobaba contexto, pero no exigía que el documento fuera un albarán **confirmado + factura explícita + nº/fecha válidos**;
- la firma documental de P04 todavía no incluía `esFactura`, `numeroFactura` ni `fechaFactura`, por lo que la semántica financiera no quedaba congelada dentro de la identidad confirmada.

Eso contradecía el contrato P02: un albarán simple no debe crear deuda y los datos legacy ambiguos no deben convertirse silenciosamente en nuevas obligaciones.

## Corrección aplicada

### 1. Albarán simple por defecto

Los flujos nuevos de albarán pasan a nacer con:

- `esFactura: false` explícito.

Además, `guardarAlbaran` normaliza una escritura realmente nueva con `esFactura == null` a `false`, sin reescribir silenciosamente documentos legacy ya existentes.

### 2. Factura operativa explícita

Se añadieron helpers P05 para exigir:

- `esFactura === true`;
- `albaran.id` estable;
- empresa, local y proveedor explícitos;
- `numeroFactura` no vacío;
- `fechaFactura` ISO válida (`YYYY-MM-DD` y fecha calendárica real).

Un `undefined/null` legado:

- puede seguir siendo leído como dato histórico;
- **no** se considera una factura operativa P05;
- no puede entrar en el flujo de pago por omisión.

### 3. Identidad de obligación

Una factura válida genera una identidad persistida `obligacionFacturaPM11` con:

- `facturaId = albaran.id`;
- `origenFactura = "albaran"`;
- `empresaId`;
- `localId`;
- `proveedorId`;
- `numeroFactura`;
- `fechaFactura`;
- `clave` canónica financiera.

La clave canónica usa empresa + proveedor + número normalizado. Si ya existe otra factura confirmada y operativa con la misma identidad, la nueva confirmación devuelve `factura_duplicada`.

La obligación primaria continúa siendo el propio `albaran.id` con `origenFactura="albaran"`, de acuerdo con P02 y con el ledger PM06 existente.

### 4. Firma documental P04 ampliada

`firmaConfirmacionAlbaranPM11` incorpora ahora también:

- `esFactura`;
- `numeroFactura`;
- `fechaFactura`.

Por tanto, la decisión financiera forma parte del documento confirmado y no puede reinterpretarse con el mismo ID como si fuera el mismo contenido.

### 5. Cuentas por pagar / Facturas

Las lecturas financieras dejan de usar `esFactura !== false`.

Solo un documento que cumpla `albaranEsFacturaOperativaPM11` puede aparecer como obligación de albarán:

- confirmado;
- `esFactura === true`;
- número de factura presente;
- fecha de factura válida.

### 6. Pago y reverso

`marcarPagada` queda cerrado para:

- albarán no confirmado;
- albarán simple;
- dato legacy ambiguo;
- factura sin número;
- factura con fecha inválida;
- identidad financiera duplicada;
- documento fuera de empresa/local autorizados.

Solo después de esas comprobaciones delega en el ledger PM06 (`registrarPagoPM06` / `revertirUltimoPagoPM06`).

P06 será el punto que someta ese ledger a la secuencia parcial → total → reverso dentro del E2E PM11.

## Casos automatizados P05

`tests/pm11-compra/p05-factura-identidad-contract.mjs` prueba:

- albarán simple explícito = sin obligación;
- `undefined` legacy = sin obligación nueva;
- intento de pagar legacy/no factura = rechazado;
- factura sin número = rechazada;
- fecha imposible = rechazada;
- factura válida = identidad canónica correcta;
- factura confirmada operativa = reconocida;
- misma identidad empresa/proveedor/nº en otro albarán confirmado = `factura_duplicada`;
- proveedor o empresa distintos no colisionan;
- cambiar albarán simple → factura cambia la firma P04;
- nuevas altas contienen defaults `esFactura:false`;
- desaparece el contrato heredado `esFactura !== false` de `fuente.js`;
- confirmación valida identidad financiera antes del replay/efecto físico;
- confirmación persiste `obligacionFacturaPM11`;
- pago exige factura confirmada y explícita;
- Cuentas por pagar / Facturas usan factura operativa explícita;
- regresiones P04, P03, PM10-P06, PM10-P05 y P02.

## Ejecuciones

- Run inicial P05 `34088094590`: **FAIL** únicamente por una aserción demasiado amplia del test (`/esFactura: true,/`). El literal `true` era correcto dentro del propio resultado del helper de validación; el fixer y `node --check fuente.js` ya habían pasado. No se creó commit funcional en ese intento.
- Se corrigió la aserción para comprobar los defaults nuevos `esFactura:false` y la eliminación real de `esFactura !== false`, sin prohibir usos legítimos de `true` dentro de la lógica.
- Run P05 `34088140144`: **SUCCESS**. Pasaron contrato P05, regresión P04, P03, PM10-P06, PM10-P05 y contrato E2E P02.
- Ese workflow generó el commit funcional `6722a946ab648b3f6e5893f3876637a7857efdc5` con mensaje `PM11 compra P05: cerrar identidad de factura y obligacion`.

## Límite honesto

P05 cierra semántica, identidad y acceso al flujo financiero con el modelo de persistencia actual. No afirma todavía atomicidad ACID entre documento, obligación y ledger ni resuelve ventanas de crash/concurrencia multicliente; esas pruebas pertenecen a P08.

P05 tampoco declara cerrado el ciclo de pago. La secuencia pago parcial, pago total y reverso sobre la factura exacta se prueba específicamente en **P06**.

## Estado

**PM11_COMPRA_P05_FACTURA_IDENTIDAD=PASS**

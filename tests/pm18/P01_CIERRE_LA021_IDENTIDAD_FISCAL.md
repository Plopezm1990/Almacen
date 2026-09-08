# PM18 P01 — LA-021: identidad fiscal nunca se presenta como verificada sin serlo

Primer punto de PM18 (Empresas, documentos y exportaciones). Cubre la mitad
"verificación" del alcance que definiste ("1. Verificación de identidad fiscal y estado
provisional"). La mitad de habilitación de facturación (punto 2) **no se cierra en este
punto** — ver sección final.

## Diagnóstico (inspección de código real)

`renderTicketVenta` (el ticket que se imprime al cliente en cada venta) tenía:

```js
const razonSocialEmpresa = empresa.razonSocial || "CHOCOLOYOS, S.L.";
const nifEmpresa = empresa.nif || "B87342077";
```

Si la Empresa activa no tenía razón social/NIF configurados, el ticket **no lo indicaba**:
mostraba esos dos valores fijos como si fueran los datos reales del negocio. El caso es
más grave de lo que parece a primera vista: `"B87342077"` **pasa el dígito de control real
de un CIF** (verificado en este mismo contrato) — es decir, no solo parecía un NIF/CIF
real, tenía formato sintácticamente válido, indistinguible de uno auténtico para cualquiera
que lo mirara.

El mismo par de valores era también el **estado inicial** de `configEmpresa` (el
`useState` legacy usado como último recurso cuando no existe ninguna Empresa creada
todavía) — visible en la ventana entre el montaje del componente y que termine la carga
real de datos.

No existía **ninguna validación de formato** de NIF/CIF/NIE en ningún punto de la
aplicación (`GestorEmpresas`, `FichaEmpresaBasica`) — cualquier texto se guardaba y
mostraba tal cual.

## Solución

- **`tipoIdentificadorFiscalPM18(valor)`**: clasifica por forma (NIF/NIE/CIF), tolerante a
  mayúsculas/espacios/guiones; `null` si no coincide con ningún patrón español conocido.
- **`validarIdentificadorFiscalEspanaPM18(valor)`**: dígito/letra de control real —
  algoritmo NIF/NIE estándar (mod 23) y algoritmo CIF (BOE, suma ponderada + tabla de
  letras, con los grupos que exigen letra de control frente a los que exigen dígito).
- **`estadoIdentidadFiscalPM18(valor)`**: estado provisional inequívoco —
  `ausente` / `formato_desconocido` / `invalido` / `sin_verificar`. **Nunca** devuelve
  "verificado": esta pieza valida formato y dígito de control, no hace ninguna
  comprobación contra la Agencia Tributaria (eso sería una integración de red nueva, fuera
  de este alcance, y ni se ha construido ni se ha activado).
- **Ticket de venta**: ya no rellena con datos fijos. Con NIF de formato válido, lo
  muestra tal cual (igual que antes en el caso bueno). Sin NIF, con formato inválido o de
  un tipo no reconocido, lo dice explícitamente ("Sin NIF/CIF configurado" / "NIF/CIF con
  formato inválido" / "Formato no reconocido (revisar)"). Una razón social ausente
  muestra "Razón social no configurada" en vez de inventar un nombre de empresa.
  Adicionalmente, la etiqueta legal "FACTURA SIMPLIFICADA" (frente a "TICKET / RECIBO
  INTERNO") ahora exige que el NIF tenga formato válido — nunca se etiqueta como
  documento fiscal un ticket cuya empresa no tiene ni siquiera un NIF con formato correcto
  detrás.
- **Estado inicial de `configEmpresa`**: se retiran los mismos dos valores fijos del
  `useState` inicial (quedan `""`, igual que el resto de reconciliaciones ya existentes en
  el código de carga) — cierra la ventana de exposición antes de que termine la carga real.
- **Ficha de empresa, alta de empresa nueva y listado de empresas**: muestran el estado
  real del NIF (con color de aviso si es inválido) en el mismo lugar donde se edita/lista,
  no solo en el ticket.

## Archivos

- `fuente.js`: `tipoIdentificadorFiscalPM18`, `validarIdentificadorFiscalEspanaPM18`,
  `estadoIdentidadFiscalPM18`, `etiquetaEstadoIdentidadFiscalPM18` (nuevas, antes de
  `FichaEmpresaBasica`); `renderTicketVenta`, `FichaEmpresaBasica`, `GestorEmpresas` y el
  `useState` inicial de `configEmpresa` actualizados para usarlas.
- `tests/pm18/p01-identidad-fiscal-contract.mjs` (nuevo): clasificación por tipo,
  validación de dígito/letra de control (positivo/negativo, incluyendo el propio
  placeholder retirado como caso documentado de "formato válido no implica dato real"),
  estado provisional (nunca "verificado").
- `tests/pm18/p01-wiring-identidad-fiscal-contract.mjs` (nuevo): por inspección estática,
  confirma que los dos placeholders han desaparecido del bundle, que el estado inicial no
  fabrica identidad, y que ticket/ficha/alta/listado usan la clasificación real.

## Regresión

Suite completa: `tests/g1`, `pm04`, `pm05`, `pm07`, `pm08`, `pm09`, `pm10`,
`pm11-compra`, `pm12`, `pm13`, `pm14`, `pm15`, `pm16`, `pm17`, `pm18` — 93/93 sin
regresiones.

## Estado de main/producción

`main` = `a44f1c71df449a4da98596ffa78a4428992ab539` (release consolidado hasta PM17), sin
tocar directamente. Frontend puro, sin migraciones Supabase. No se ha activado ningún
envío ni emisión real. `L&A Suite` (producción) y `TPV` no se han tocado.

## Punto 2 — habilitación de facturación: BLOQUEADO, no cerrado

Instrucción explícita: la habilitación de facturación fiscal **queda bloqueada** hasta
definir y validar, en un turno futuro y con la autorización correspondiente:

- Revisión fiscal especializada.
- Países y tipos documentales admitidos (hoy la app y este contrato solo cubren personas
  físicas/jurídicas españolas — NIF/NIE/CIF; ningún otro país tiene reglas implementadas).
- Reglas de numeración fiscal real.
- Autoridad y condiciones de activación (quién puede habilitarlo y bajo qué requisitos).
- Auditoría, reversión y pruebas correspondientes a esa activación.

**No se ha creado ningún flag, estado ni mecanismo de habilitación** en este punto —
decisión explícita, no un olvido. La etiqueta "FACTURA SIMPLIFICADA" del ticket sigue sin
ser alcanzable en la práctica (nada en el código asigna `numeroFiscal` a una venta; ese
camino sigue completamente inactivo, como ya lo estaba antes de este punto) y ahora,
además, exige NIF con formato válido incluso si algún día se activara. **No existe
numeración fiscal productiva ni emisión de documentos fiscales reales en la aplicación.**

Este documento cierra el diagnóstico y la verificación de identidad fiscal (P01) como
bloqueo justificado del punto 2 — **el alcance fiscal completo de PM18 sigue abierto**
hasta que el punto 2 se aborde explícitamente con autorización propia.

# Piloto · Rehacer una pantalla completa según la maqueta

13 de noviembre de 2026. Pantalla elegida: **acceso (`acc-01`)**. El objetivo del
piloto no es la pantalla: es **medir el método** antes de comprometer las 267.

## Por qué esta pantalla

Autónoma, sin lógica de negocio ni contratos de datos, con la maqueta muy
definida, y es la primera que ve cualquiera. Riesgo bajo, señal alta. Si el
método pelea aquí, pelea en todas.

## Lo que había que saber antes de empezar

**No se puede recompilar desde la fuente legible.** Medido contra la evidencia
del repositorio: compilar `fuente-recuperado.js` da 4.900.319 bytes; el bundle
certificado son 5.500.891 y el desplegado hoy, 6.309.658. La fuente recuperada
no reproduce el artefacto. La única vía certificada es **editar las dos copias
con texto idéntico** y verificar con `recuperar_candidato.py --check`.

**Las pantallas no son componentes sueltos.** 102 componentes en 31.286 líneas,
pero `GestionAlmacen` tiene 12.144, `VentaRapida` 3.278 y `AppConSesion` 2.513.
Unas 18.000 de las 31.000 líneas están en tres componentes, y ahí viven los
módulos de uso diario como ramas de un `tab === ...`.

## El método, ya probado

1. Localizar el bloque exacto de la pantalla en `source-recovery/fuente-recuperado.js`.
2. Escribir el reemplazo aparte, conservando **todos** los manejadores y estados
   que ya existen (`entrar`, `email`, `password`, `error`, `cargando`,
   `entrarSinNube`).
3. Sustituir el mismo texto en los dos archivos con un script, nunca a mano.
4. `node --check` en ambos y `python recuperar_candidato.py --check`.
5. Banco estático con la misma hoja de estilos para medir disposición,
   contraste y tamaños sin tocar la sesión de QA.
6. Batería de 304 contratos.

## Lo que costó

| | |
|---|---|
| Bloque sustituido | 25 líneas, 3.713 bytes |
| Bloque nuevo | ~130 líneas de fuente legible |
| Archivos tocados | 2, con texto idéntico |
| Paridad de cuerpo | `PARIDAD_CUERPO_EXACTA=1`, `SOURCE_RECOVERY_CHECK=PASS` |
| Medidas | 1440 px: dos columnas de 662 y 778. 800 px: una columna |
| Controles bajo 44 px | 0, tras corregir |
| Desbordamiento horizontal | ninguno |

## Lo que apareció por el camino

**Un defecto propio, cazado por la medición.** Los dos enlaces secundarios
—«¿Olvidaste tu contraseña?» y «Trabajar solo en este equipo»— quedaban a 17 px
de alto. Son controles operativos y el objetivo del plan es 44 × 44. Corregido
antes de publicar. La lección es que la comprobación automática de tamaños hay
que hacerla en **cada** pantalla, no al final.

**Una dependencia real, documentada.** La maqueta pone en el acceso una pestaña
de «Acceso de empleados con PIN». En el programa eso **no puede existir antes de
iniciar sesión**: `pm11_verificar_pin_empleado` exige `auth.uid() is not null` y
solo está concedida a `authenticated`. El PIN es un segundo factor dentro de una
sesión, no una vía de entrada. La pantalla lo dice en vez de ofrecer un botón
que el servidor rechazaría. Para que la maqueta se cumpla al pie de la letra
haría falta un contrato nuevo de autenticación por PIN sin sesión previa, con
su propio diseño de seguridad.

## Lo que no se tocó

Los manejadores, el control de intentos y bloqueo (M-04), el flujo de MFA y la
recuperación de contraseña. Solo cambia la presentación.

## Proyección honesta

Esta pantalla es de las fáciles: aislada, sin datos, 25 líneas. Las de los tres
componentes grandes no se parecen en nada a esto. Tomar el coste de esta
pantalla y multiplicarlo por 267 daría una estimación falsa y optimista. Lo
razonable es pilotar **una segunda pantalla de las difíciles** —una rama dentro
de `GestionAlmacen`— antes de dar un plazo para el conjunto.

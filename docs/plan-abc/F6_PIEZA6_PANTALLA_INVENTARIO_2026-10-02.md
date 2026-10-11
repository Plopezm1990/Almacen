# F6 · pieza 6: pantalla de configuración — inventario y plan por sub-piezas

Fecha: 2026-10-02
Alcance de este documento (escrito antes de implementar): **solo lectura** del código de la aplicación y de las migraciones, y este informe. Producción no consultada.
Autorización: «Pieza 6: pantalla de configuración» elegida por Pedro el 2/10/2026 (solo QA, como las piezas anteriores).
Estado: `INVENTARIO_HECHO` — **primera entrega (6a+6b+6c+6f) hecha y en rama**: ver `F6_PIEZA6_PANTALLA_RESULTADO_2026-10-02.md`; 6d autorizada, implementada y aplicada solo en QA (`F6_PIEZA6D_CIERRE_DIFERENCIA_RESULTADO_2026-10-02.md`; probada en pantalla y en QA el 3/10/2026, incluida la aprobación de una diferencia); 6e autorizada por Pedro, implementada solo en el cliente (sin tocar el servidor ni QA): plan en `F6_PIEZA6E_MODALIDAD_AL_ABRIR_CUENTA_PLAN_2026-10-02.md`, informe en `F6_PIEZA6E_MODALIDAD_AL_ABRIR_CUENTA_RESULTADO_2026-10-02.md` (probada por Pedro el 3/10/2026 en el preview y comprobada en QA)

## Cómo está hecha la aplicación (lo que condiciona el trabajo)

| Hecho | Consecuencia |
|---|---|
| La aplicación es un único archivo grande, `fuente.js` (5,8 MB, con las librerías), y su espejo `source-recovery/fuente-recuperado.js` (1,8 MB, solo la lógica de la app). Una comprobación de paridad (`recuperar_candidato.py --check`) exige que la lógica coincida | **Todo cambio de pantalla se hace idéntico en los dos archivos** |
| No hay JSX: las pantallas se escriben con `React.createElement`. Cada pantalla es una función (por ejemplo `PoliticasDescuentos`) | Código largo y literal; se escribe en el mismo estilo |
| El menú es una lista (`itemsMeta`) agrupada en `GRUPOS` («Sistema»: auditoría, respaldos, notificaciones, locales, errores del sistema…). Un mapa de roles (`ROLES_EMPLEADO`) decide qué pestañas ve cada puesto **cuando la aplicación está en «modo empleado»**; fuera de ese modo se ven todas. Además cada pantalla comprueba el perfil (`esPropietarioPM29`) y **el servidor es quien impone el permiso real** | La pantalla nueva sería una pestaña más, fuera del modo empleado, que además comprueba que el perfil sea Propietario (y el servidor lo exige igualmente) |
| Ya existe **una pantalla de configuración del propietario**: «Descuentos y cortesías» (`PoliticasDescuentos`). Solo Propietario, pide un local concreto, llama al servidor con `window.getSupabaseClient()`, exige un motivo y guarda con `operation_id` | Es el **modelo** que seguiría la pantalla nueva |
| Las pantallas de caja y cocina (A10) llaman al servidor con un contexto ya resuelto (empresa, local, sesión de caja, terminal, día operativo) | Se reutiliza para lo que toque el cierre |
| Cada `push` reconstruye el preview 118 (solo QA) | Se puede probar sin tocar producción |
| **No puedo iniciar sesión** en el preview (no tengo credenciales de QA; así se hicieron P1 y P3) | Las pruebas serán estáticas y de contrato; **Pedro prueba en la pantalla** con una guía y yo compruebo en QA, solo lectura, lo que quede guardado |

## Lo que el servidor ya ofrece (piezas 1 a 5) y la pantalla tendría que usar

| Sección de la pantalla | Funciones | Quién |
|---|---|---|
| Día y cajas | `abc_obtener_ajustes`, `abc_configurar_ajuste` (claves `cajas_abiertas_max` y `caja_diferencia_umbral`), `abc_configurar_dia_operativo` (zona horaria y hora de corte) | leer: miembros; cambiar: Propietario |
| Diferencia de caja | `abc_obtener_diferencia_caja`, `abc_registrar_diferencia_caja` (motivo), `abc_decidir_diferencia_caja` (aprobar o rechazar) | cajero: registrar; Propietario: decidir |
| Modalidades | `abc_obtener_modalidades_local`, `abc_configurar_modalidad_local` | leer: miembros; cambiar: Propietario |
| Equipos | `abc_listar_equipos_local`, `abc_configurar_equipo_local` | leer: miembros; cambiar: Propietario |
| Permisos | `abc_obtener_capacidades_rol`, `abc_configurar_capacidad_rol` (local o empresa), `abc_listar_roles_retirados` | leer: miembros; cambiar y listar retirados: Propietario |

La política de descuentos ya tiene su pantalla; el descuento del encargado (D12) se sigue configurando allí.

## Lo que las pantallas actuales hacen mal con las piezas 1 a 5

1. **Cierre de caja con diferencia (pieza 2).** La pantalla finaliza el cierre sin más; si el contado no coincide, el servidor
   responde `cierre_definitivo_diferencia_pendiente` y la pantalla solo muestra el error. Falta pedir el motivo, registrarlo y que
   el Propietario apruebe (con el umbral de 0 € elegido, **cualquier** diferencia lo necesita). **En QA hoy no se puede finalizar un
   cierre con diferencia.**
2. **Abrir una cuenta (pieza 3).** El TPV abre siempre la cuenta en `BARRA`. Si el propietario deshabilita BARRA, abrir cuentas
   dará `modalidad_no_habilitada:BARRA`. Falta elegir entre las modalidades habilitadas.
3. **Reabrir un cierre (pieza 5, D14).** El botón se ofrece a quien llegue a esa pantalla; ahora solo puede el Propietario, y a los
   demás les da error (`abc_caja_no_autorizado`).
4. **Alta de empleados con rol (pieza 5).** La lista de roles (`NOMBRES_ROLES`) incluye Básico, Estándar y Churrero/a; elegir uno
   da `rol_retirado:<rol>`. El mapa `ROLES_EMPLEADO` y la pantalla de descuentos también los conservan.
5. **Local concreto.** Toda la configuración es por local (o por empresa en permisos): la pantalla necesita un local elegido, como
   «Descuentos y cortesías».

## Plan por sub-piezas (cada una con su autorización)

| Sub-pieza | Qué incluye | Qué toca | Riesgo |
|---|---|---|---|
| **6a** Pantalla «Configuración», solo lectura | Las cinco secciones mostrando los valores actuales (día y cajas, diferencia, modalidades, equipos, permisos) | Una pestaña nueva; no toca flujos | Bajo |
| **6b** Ajustes editables | Cambiar corte del día, cajas máximas, umbral, modalidades y equipos (cada guardado = una llamada con motivo) | La pestaña nueva | Bajo a medio |
| **6c** Permisos | Matriz editable (31 capacidades × 3 roles, local y empresa, techo visible) y lista de personas con rol retirado | La pestaña nueva | Medio |
| **6d** Cierre con diferencia | Motivo y aprobación del propietario en la pantalla de cierre | **El flujo de caja** | Medio a alto |
| **6e** Modalidad al abrir cuenta | Elegir entre las habilitadas en el TPV | **El flujo de venta** | Medio a alto |
| **6f** Retoques | Ocultar «Reabrir» a quien no pueda y quitar los tres roles de la lista de alta | Dos pantallas existentes, líneas sueltas | Bajo |

**Recomendación:** una primera entrega con la **pantalla completa y los retoques (6a + 6b + 6c + 6f)**: es una pestaña nueva y
autónoma, más dos cambios pequeños que quitan errores conocidos, y se puede probar entera en el preview. **6d y 6e**, que cambian el
cobro y el cierre que ya usan los equipos, **después y por separado**, cada una con su autorización.

Decisiones de diseño que tomo salvo que Pedro diga otra cosa: la pestaña se llama «Configuración», va en el grupo **Sistema**, no
aparece en «modo empleado» y la pantalla exige perfil **Propietario**; sigue el patrón de «Descuentos y cortesías» (local concreto, motivo en cada cambio, avisos claros en
español, errores del servidor traducidos); en el móvil se muestra en una columna.

## Pruebas previstas

- Contrato estático de pantalla (como los de A05–A10): paridad exacta entre `fuente.js` y `fuente-recuperado.js`; la pestaña no sale en
  «modo empleado» y la pantalla exige perfil Propietario; **cada llamada usa el nombre exacto de la función y de sus parámetros** (se comprueba contra las firmas de las
  migraciones); no se accede a ninguna tabla directamente; cada cambio lleva motivo y `operation_id`; los tres roles retirados no
  salen en la lista de alta.
- Averías provocadas sobre ese contrato (mutantes), como en las piezas anteriores.
- Regresión: comprobación de paridad de la fuente recuperada y contratos de pantalla existentes.
- **Prueba en pantalla por Pedro** en el preview 118 con una guía paso a paso, y comprobación mía en QA (solo lectura) de lo que
  quede guardado.

## Límites

- Sin credenciales de QA no puedo ver la pantalla funcionando: **la primera vez que se renderice será en el navegador de Pedro**.
- La cadena de reconstrucción exacta del bundle (`CURRENT_RELEASE.patch`) la regenera la integración continua, no la hago a mano.
- Producción: nada de esto está autorizado; antes de promocionar habría que adaptar los contratos históricos citados en
  `F6_PIEZA5_PERMISOS_2026-10-02.md` y registrar los contratos nuevos en la puerta de CI.

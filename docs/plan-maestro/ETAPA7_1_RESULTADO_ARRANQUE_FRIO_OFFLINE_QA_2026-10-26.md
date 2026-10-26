# Plan Maestro L&A Suite — Etapa 7.1 — arranque frío offline

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Estado: `PRUEBA_TERMINADA; NO_APTO_PARA_ARRANQUE_FRIO_OFFLINE; CORRECCION_PENDIENTE`

## 1. Objetivo

Comprobar si la suite puede arrancar desde cero cuando el navegador pierde la
conectividad antes de cargar la aplicación. Esta prueba es distinta de la
prueba offline sobre una vista ya hidratada: aquella verifica que una pantalla
operativa no cobra ni guarda mientras se corta la red; esta verifica si existe
un shell inicial, caché o mecanismo equivalente para poder abrir la aplicación
sin red.

La prueba se realizó exclusivamente contra QA y no utilizó el proyecto
Supabase de producción. No se pretendía guardar una comanda, cobrar, abrir
Caja, modificar productos ni alterar ningún dato.

## 2. Procedimiento reproducible

1. Se partió de la sesión QA del propietario en `Local A2`, con el ticket vacío
   y sin una operación pendiente.
2. Se activó la emulación de red offline del navegador antes de recargar.
3. Se ejecutó una recarga ignorando la caché del navegador.
4. Se observó el resultado de navegación y la superficie visible.
5. Se restauró la conectividad.
6. Como recuperación de la herramienta de prueba, se abrió una nueva pestaña
   del mismo preview y se confirmó que la suite volvía a cargar.

## 3. Resultado observado

La aplicación no llegó a montar su interfaz durante el arranque frío offline.
El navegador mostró su página nativa de error con:

- título: `No se puede acceder a este sitio`;
- causa visible: el ordenador no está conectado a Internet;
- código: `ERR_INTERNET_DISCONNECTED`.

No se mostró el shell de L&A Suite, no se mostró el TPV y no hubo una
pantalla de recuperación propia de la aplicación. Por ello, no es correcto
marcar esta prueba como PASS ni afirmar que existe soporte de arranque offline.

## 4. Seguridad y alcance de la incidencia

La prueba terminó antes de entrar en la aplicación. No se produjo ninguna
mutación de negocio: `0` ventas, `0` cobros, `0` movimientos de Caja, `0`
productos modificados y `0` cambios de sesión. Tampoco se tocó producción.

El resultado no invalida la evidencia anterior de la vista TPV ya hidratada:
con la pérdida temporal de red sobre esa vista, el ticket permaneció en
`0 líneas · €0,00`, `F9 Guardar` siguió deshabilitado y no aparecieron errores
nuevos. Son dos garantías diferentes:

| Garantía | Resultado |
|---|---|
| No cobrar/no guardar mientras una vista ya cargada pierde red | PASS en QA |
| Arrancar la aplicación después de recargar sin red | NO APTO; pendiente |

## 5. Diagnóstico experto

El preview no dispone, en el estado probado, de un arranque offline autónomo
para el documento inicial y sus recursos principales. Para convertir este
resultado en PASS se necesita una estrategia explícita, por ejemplo un shell
estático precacheado mediante service worker y una pantalla de recuperación
que permita abrir el estado local sin llamar a Supabase hasta que vuelva la
red. La solución debe mantener la regla de seguridad: sin conectividad no se
puede presentar un guardado como confirmado ni generar cobros ambiguos.

No se implementa esa corrección dentro de esta prueba porque el objetivo de la
tanda era medir y registrar el comportamiento actual. La corrección deberá
ser una tarea separada, con sus propios contratos, build y repetición del
arranque en frío.

## 6. Recuperación del entorno de prueba

La emulación offline se desactivó. La pestaña original quedó en la página
nativa de error del navegador porque el navegador ya había sustituido la URL
por su documento interno de error. Se abrió una pestaña QA nueva con el mismo
preview y se verificó que la suite cargaba de nuevo mostrando el panel de
plataforma, por lo que la conectividad y el preview quedaron operativos.

## 7. Decisión

**Prueba de arranque frío offline: TERMINADA. Resultado: NO APTO PARA CERRAR
LA GARANTÍA OFFLINE DE ARRANQUE.**

La Etapa 7.1 no debe cerrarse completamente mientras esta garantía siga
siendo requisito del plan. La evidencia de TPV responsive, guard offline en
vista hidratada, roles, Caja y aislamiento A1/A2 permanece válida.

## 8. Qué sigue

1. Abrir una tarea de corrección del arranque offline: shell estático,
   precache, recuperación visible y política de no mutación.
2. Añadir contratos automatizados para comprobar que el shell puede abrirse
   sin red y que las operaciones server-side siguen bloqueadas.
3. Desplegar la corrección en un preview QA.
4. Repetir esta misma prueba con caché limpia, red desconectada desde el
   inicio, recarga y recuperación de conectividad.
5. Solo si el arranque frío queda en PASS, continuar con T9 física cuando se
   disponga de impresora, cajón y dispositivo autorizados.

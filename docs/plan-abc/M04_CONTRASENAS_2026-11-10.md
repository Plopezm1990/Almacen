# M-04 — Política de contraseñas y limitación visible de intentos

Fecha de revisión: 2026-11-10  
Rama de corrección: `fix/m04-password-policy`

## Estado

La corrección está versionada y el contrato estático pasa sobre una extracción limpia de la rama. El preview integrado del PR #220 para el commit `e179b807` está listo en Netlify (`6af3746d4210a5c82f09d07b`), pero todavía no se ha observado el flujo de login en navegador ni se ha publicado la corrección en producción.

## Corrección

El commit `57cbc8e0` (`fix: endurecer politica de contrasenas M04`) incorpora:

- mínimo de 8 caracteres en la creación de cuentas desde la aplicación;
- límite superior de 200 caracteres en las funciones Edge que crean cuentas;
- eliminación del mensaje y validación antigua de 6 caracteres;
- bloqueo local visible después de 5 intentos fallidos durante 60 segundos;
- rechazo del intento mientras el bloqueo está activo;
- reinicio del contador tras un inicio correcto.

La limitación visible de intentos es una defensa de interfaz. No se presenta como sustituto de un rate limit server-side de Supabase Auth; la efectividad frente a clientes modificados queda fuera de lo que demuestra este contrato.

## Verificación reproducida

Sobre la extracción limpia de `fix/m04-password-policy`:

```text
M04_PASSWORD_POLICY_CONTRACT=PASS
```

También pasaron `node --check` sobre `fuente.js` y `source-recovery/fuente-recuperado.js`.

El contrato comprueba el mínimo y máximo en las dos funciones Edge, el texto visible de 8 caracteres, el umbral de cinco intentos, la duración de 60 segundos, la consulta del bloqueo y el mensaje visible.

## Límites de despliegue

- No se escribió en producción.
- No se crearon usuarios ni cuentas de prueba en QA para este punto.
- No se ha medido un login fallido real en un preview actualizado.
- No se ha demostrado que el proveedor Auth aplique una limitación server-side frente a clientes manipulados.
- El preview QA está publicado y listo, pero no se certifica todavía el flujo funcional contra Auth desde navegador.
- Producción no se ha modificado ni publicado.

## Clasificación

| Afirmación | Evidencia |
|---|---|
| Mínimo de 8 y máximo de 200 en los caminos de alta | Probado por código y contrato reproducido |
| Bloqueo visible de cinco intentos durante 60 segundos | Probado por código y contrato reproducido |
| La rama integrada está publicada en el preview QA | Medido en Netlify, commit `e179b807`, deploy `6af3746d4210a5c82f09d07b` |
| La aplicación publicada en producción ya usa la corrección | No demostrado; producción no se ha modificado |
| El rate limit protege server-side contra clientes modificados | No demostrado |

M-04 queda avanzado como corrección versionada, regresión reproducida y preview QA listo, pero continúa abierto para el cierre completo hasta observar el flujo autenticado y disponer de una promoción autorizada o de la evidencia equivalente en producción. La protección server-side frente a clientes manipulados tampoco queda demostrada por este cambio.

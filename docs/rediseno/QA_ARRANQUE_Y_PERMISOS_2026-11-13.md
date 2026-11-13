# Arranque y permisos de Apariencia en QA

**Entorno:** L&A Suite QA `qjqorixtkilwsndqayyx`, Deploy Preview del PR #225. **Base observada:** `08e80e59add2bc7b61b40640e7b7841ae8de492b`. Producción se mantuvo fuera del trabajo.

## Apariencia con un cargo restringido

En PostgreSQL de QA se seleccionó la única membresía activa de ensayo de Camarero/a de QA-A1 y se ejecutaron las funciones con rol `authenticated` y contexto de esa identidad limitado a la transacción. La lectura devolvió `puede_aplicar=false`. Aplicar y restaurar devolvieron `apariencia_no_autorizada`. El intento fallaría y revertiría si el servidor aceptase escribir. La apariencia de QA-EMP-A siguió en Pase, revisión 5, con cinco filas de historial y cero delegaciones. Es una prueba del servidor instalado. La prueba de inicio de sesión y pantalla en el preview requiere una cuenta de prueba con acceso.

Se verificó que el correo sugerido anteriormente no corresponde a esa membresía activa de Camarero/a en QA-A1. Usar una cuenta restringida disponible o crear una nueva desde Personal con el propietario de QA. No se modificó el acceso de ninguna cuenta.

El editor ahora deja visibles y desactiva Aplicar y Restaurar cuando el servidor confirma que el cargo está restringido. Mantiene accesibles la consulta y la prueba temporal. El banco comprueba los controles y el aviso con una respuesta de servidor simulada.

## Incidencia de carga tras cambiar el local

En la ventana de 09:42:30 a 09:53:00, hora de Madrid, los registros de QA muestran 5.895 respuestas 200 para `obtener_contexto_operativo`, 5.857 para `almacen_kv` y 204 respuestas 500 para `movimientos_registro`. La consulta de movimientos pedía 1.000 filas ordenadas por fecha en la primera página. PostgREST registró `57014` y cancelaciones por tiempo de ejecución. En el intervalo más amplio de 09:35 a 10:15, las 704 lecturas de `configEmpresa` registradas en el borde devolvieron 200 y 696 usaban el contexto de empresa pendiente. Los registros muestran repetición del arranque y tiempos de espera de movimientos. La coincidencia temporal con la selección «Todos los locales» requiere una prueba funcional controlada para establecer si esa selección inicia el ciclo.

El componente principal volvía a la pantalla de comprobación y reconstruía el panel ante notificaciones repetidas del mismo token. El cambio deduplica estas notificaciones durante la validación, el reto MFA y el panel abierto. Una sesión o un token nuevo conserva la validación de MFA. La salida o una validación más reciente invalidan resultados en curso. El contrato aislado comprueba repetición, renovación, reto, salida y desmontaje. Queda verificar el flujo con dos pestañas y un cambio A1 → A2 → Todos → A1 en el preview, midiendo solicitudes y manteniendo abierta solo la sesión necesaria. Si el tiempo de espera de movimientos persiste, estudiar esa consulta y su plan por separado.

Pase borra de inmediato el plano, la cola, los filtros y la mesa seleccionada cuando cambia el contexto. Descarta respuestas pendientes del local anterior y evita consultar sala y cocina sin un local operativo. Se comprobó en el banco aislado con una respuesta antigua retrasada.

## Pendientes

- Verificar Aplicar/Restaurar desactivados y Probar disponible en el preview con sesión de Camarero/a. Si procede, comprobar concesión y retirada de una delegación temporal en QA con el procedimiento del programa.
- Registrar `20261113090000` mediante el procedimiento del repositorio. El Editor SQL aplicó el esquema y la CLI disponible carece de sesión. El registro es independiente del funcionamiento de Apariencia.
- Verificar la incidencia de arranque con sesiones reales y conservar los resultados separados de los de F2. Continuar F3 con las composiciones, navegación y atajos del resto de propuestas, que todavía comparten la presentación del producto con tokens de color y tipografía.

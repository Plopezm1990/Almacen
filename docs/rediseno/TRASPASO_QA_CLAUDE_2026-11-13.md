# L&A Suite · Traspaso de integración a Claude Code

13 de noviembre de 2026, hora de Madrid. Trabajar en Almacen-qa-rediseno, rama rediseno/f0-base-qa, PR #225 contra release en borrador. Preview https://deploy-preview-225--chic-entremet-9107cf.netlify.app. Supabase QA qjqorixtkilwsndqayyx. Mantener el PR sin fusionar y las pruebas en QA.

## Cambios publicados

| Commit | Trabajo y evidencia |
| --- | --- |
| 55e4ddb4 | Deduplicación de notificaciones del mismo token de sesión, preservando MFA. Pase descarta respuestas del local anterior. El editor desactiva Aplicar y Restaurar cuando el servidor deniega al cargo. Con propietario real pasó A1 → A2 → Todos → A1 sin quedarse cargando. |
| 6f63f0c9 | Claro incorpora cabecera por áreas. Sello agrupa Ventas, Almacén, Equipo y Control. Rumbo abre el buscador de pantallas con Ctrl/⌘+K, con permisos, sinónimos, teclado, retorno de foco y guarda de borrador. Comprobados en banco y en preview. |
| c9bc6d56 | En móvil, Más → Apariencia y aviso de prueba en cabecera. Confirmado por toque. Guardar y restaurar respetan la revisión leída. Pase muestra las mesas de QA-A1 al entrar en un navegador sin pedido previo, con sesión de caja abierta y autorización vigente. |
| f1d66fdd, 36a53c86 | Cabeceras, accesos e indicadores de Oliva, Claro, Pulso, Patio, Sello y Órbita conectados al panel real. Órbita incorpora degradado, cristal, línea de puntero y entrada con alternativa de movimiento reducido. Ascua usa los contratos de Pase para ocupación y caja. En QA se verificaron caja Abierta y el enlace al detalle del indicador de Órbita. |
| 7d586926 | Clientes busca por nombre, correo o teléfono, filtra por estado y pagina ocho filas con total y controles. Preview con un registro de QA y estado sin coincidencias. Banco con 19 registros, tres páginas y datos fiscales fuera del índice. Aislamiento PM14 y guarda PM15 pasan. |
| 12d2e456 | Rumbo guarda hasta diez destinos fijados y diez recientes por cuenta, empresa, local y cargo. Comprueba permisos al mostrar y abrir destinos. Las vistas previas no escriben preferencias. Banco con dos contextos separados. |

## Evidencia previa de F0 a F3

- F0 fijó la base release y comprobó que el preview conecta solo con QA. El plan, las 267 vistas, los casos de aceptación y las maquetas están en el paquete de traspaso original. La matriz operativa está en este repositorio.
- F1/F2 permiten elegir nueve diseños, seis paletas y seis colores HEX, importar una paleta, probar temporalmente, guardar por empresa y restaurar. El propietario ya verificó en QA revisión, actor, fecha de servidor, concurrencia, restauración y propagación a dos locales y otra sesión. QA-EMP-A quedó en Pase rev. 5.
- PostgreSQL QA confirmó con la membresía sintética de Camarero/a que se puede leer, con puede_aplicar=false, y que aplicar/restaurar devuelve apariencia_no_autorizada. Revisión e historial intactos. El banco del editor comprueba controles desactivados y Probar disponible. Falta la misma comprobación con un inicio de sesión real de ese cargo y la prueba de conceder/retirar una delegación.
- F3/F4 tienen el recorrido real previo de Pase en escritorio y móvil desde mesa y cocina hasta un ticket de ensayo. Queda repetir con un cargo restringido y dos terminales según Q07/Q08.
- El incidente de arranque dejó 500 y 57014 en movimientos_registro. Las lecturas de configEmpresa devolvieron 200. A1 → A2 → Todos → A1 pasó en una pestaña después del ajuste. Falta repetir con dos pestañas y medir peticiones.

## Continuación

1. Comprobar el SHA publicado y abrir el preview. Completar F2 con una cuenta sintética QA-A1 de Camarero/a sin delegación y validar su editor. El usuario autorizó una cuenta nueva de prueba si hace falta. La cuenta sugerida en la conversación no coincide con la membresía activa verificada. Introducir credenciales en el navegador y dejar QA-EMP-A en Pase, con la delegación temporal retirada al terminar.
2. Registrar 20261113090000 en el historial con Supabase CLI migration repair y --status applied, conectado explícitamente al Session pooler del proyecto QA. El esquema está aplicado. La conexión de escritura para el CLI sigue pendiente. La validación de F2 puede avanzar en paralelo.
3. Completar F3. Prioridad en cola de Pase/Ascua por estado real, acceso a mesa/comanda exactas y móvil por cargo. El RPC de comandas actualmente consultado devuelve primero las más antiguas y limita la muestra. En QA-A1 se observaron 85 en total y dos recientes. «Comandas consultadas» cuenta esa muestra. Resolver la consulta de turno antes de presentarla como cola activa o porcentaje de preparación.
4. Terminar Rumbo con salto al registro concreto y verificar las fijadas y recientes en el preview usando un perfil cuya empresa tenga Rumbo aplicado. Continuar con las composiciones completas, pantallas de acceso y móvil de cada propuesta. Los indicadores de Órbita son margen, pedidos y stock del panel vigente. Quedan ventas, ocupación y comandas cuando se disponga del contrato y contexto adecuados. Los titulares usan las alternativas tipográficas del dispositivo si la fuente de la propuesta no está instalada.
5. Continuar F5 desde Clientes (enc-09). Quedan vistas guardadas, tipo de cliente con contrato real, ficha y actividad, NIF en el flujo fiscal autorizado, facturas, informes y el resto de las pantallas. F6/F7 conservan la cobertura de 267 vistas y la aceptación en dispositivos reales.

Evidencia en docs/rediseno/MATRIZ-IMPLANTACION-QA.csv, docs/rediseno/QA_ARRANQUE_Y_PERMISOS_2026-11-13.md y bancos docs/rediseno/banco-apariencia/. Bancos al corte de esta nota con Apariencia 19/19, Pase y Ascua 25/25, PostgreSQL local 31/31 y contratos de arranque, navegación y aislamiento de clientes en verde. Los 304 contratos Node en Windows dieron 297 correctos y los siete errores de rutas C:\C:\ de la línea base. El build publica 68 entradas y la paridad de fuente recuperada es exacta.

# Evidencia del punto 1 · TPV, sala y caja

Entorno `qjqorixtkilwsndqayyx`, QA-EMP-A / QA-A1, [Deploy Preview #225](https://deploy-preview-225--chic-entremet-9107cf.netlify.app/). El PR está en borrador y sigue sin fusionar. El modo de emisión mostrado por el TPV es `SIMULADOR_C07D`, entorno QA.

## Evidencia funcional

| Prueba | Evidencia |
| --- | --- |
| Albarán `SIM-0001` | **Anular entrada y editar** abre el diálogo, con aviso del efecto sobre stock y costes. **Cancelar** deja el albarán registrado. |
| Encargo `QA-P1-ANT-1115` | Encargo de 3,00 € con señal de 1,00 € en efectivo simulado. En el servidor consta una fila `CONFIRMADO` y un único `REVERSO` de 1,00 € vinculado a esa señal. El encargo consta una sola vez con estado `Cancelado`. En el preview de `1566cc38` aparece solo en el historial. |
| Terminales y caja | Dos terminales activos vinculados a la misma sesión de caja abierta. El TPV del primer perfil muestra **QA terminal A1 (siembra etapa 1)**. El selector permite elegir el terminal activo de un navegador todavía sin asignar. |
| Q07, plano y filtros | En Pase se comprobó Interior y Terraza con mesas libres, la ficha de Terraza conduce a la mesa exacta y, al asignar la cuenta, la mesa cambia a ocupada. El filtro de zona vacía activado con Enter muestra «Esta zona no tiene mesas activas». El filtro de cola **Cuentas** responde a Enter. |
| Q08, Terraza | Mesa `QA-P1-T01`, cuenta `b834c033-2443-4217-931f-7d57e3e08d9c`, pedido `a59e9788-06ad-4842-8447-fe4a483c7e90`. Dos Croissant (QA), 2,64 €. El servidor confirma `TERRAZA`, cuenta `ABIERTA`, pedido `ENVIADO` desde A1 y una comanda `PENDIENTE` con estación asignada. |
| Q08, Interior | Mesa `QA-P1-I01`, cuenta `609e3af6-b95b-4669-88d5-be2888775dee`, pedido `c0b7ec8c-e5a4-4397-9b59-57afd6a3b8ca`. Un Café con leche (QA) de 1,54 €, variante Pequeño, modificador Leche de avena y nota «QA punto 1: modificador avena, sin servicio real». El pedido queda guardado para recuperar desde el otro terminal. |

Las mesas de ensayo y la zona vacía se cargaron como fixtures de QA. Las dos mesas y cuentas anteriores a esta tanda se dejaron disponibles para su propio ensayo.

## Verificaciones que siguen abiertas

- Q07 y Q08 con los dos perfiles a la vez. En A2 hay que recuperar el pedido guardado de Interior, observar las mismas mesas y cuentas, y seguir por Cocina, servido y cobro simulado. Conservar los identificadores y contrastar el ticket, cambio y movimientos de stock con el servidor. Forzar el reintento sin duplicar efectos.
- Q07 con un cargo de acceso limitado, entrada táctil y movimiento reducido. El modelo comercial persiste los pedidos guardados como `ABIERTO`. El proyecto carece de un estado independiente de cuenta aparcada; la aceptación debe contrastar esto con la especificación que pide usar el modelo real.
- Acceso efectivo con una sesión restringida de QA-A1. Hay membresías activas de Camarero/a y Cajero/a en ese local. Contrastar las capacidades de caja, cobro y reembolso desde la sesión correspondiente y registrar los resultados reales.

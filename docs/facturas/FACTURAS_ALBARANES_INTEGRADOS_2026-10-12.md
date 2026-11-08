# Entrada conjunta de facturas y albaranes

Fecha: 2026-10-12

## Objetivo

Registrar una factura de proveedor y los albaranes que agrupa mediante una sola revisión y confirmación. La factura genera una única obligación de pago. Cada albarán se vincula con la factura y solo mueve stock si todavía no estaba recibido.

## Flujo operativo

1. El usuario abre **Facturas → Nueva factura**.
2. Puede introducir los datos a mano o adjuntar imágenes y PDF de varias páginas.
3. La lectura asistida agrupa las líneas por albarán, propone el proveedor y separa las bases y cuotas de cada tipo de IVA.
4. La pantalla muestra el estado de cada albarán:
   - recibido: se vincula sin mover stock;
   - borrador: se completa y recepciona;
   - nuevo: se crea y recepciona;
   - ambiguo, duplicado, sin líneas o ya facturado: bloquea la confirmación.
5. El usuario comprueba proveedor, número, fecha, IVA, total, albaranes y productos.
6. Al confirmar se crea una factura activa, se vinculan los albaranes recibidos y se aplican una sola vez las recepciones pendientes.

## Reglas de seguridad de negocio

- La identidad de una factura usa empresa, local, proveedor, serie, número y ejercicio.
- Un reintento conserva la misma identidad de operación.
- Un albarán confirmado no vuelve a mover stock.
- Un albarán vinculado a otra factura bloquea la operación.
- El total impreso debe coincidir con la suma de bases y cuotas de IVA, con tolerancia de 0,12 €.
- Cuando existen albaranes con total, su suma debe coincidir con el total de la factura.
- Los productos nuevos repetidos en varios albaranes de la misma confirmación comparten una sola ficha.
- Un conteo de inventario abierto permite guardar el borrador, pero bloquea las recepciones.
- Los borradores no aparecen en los totales económicos ni crean deuda.
- El proveedor propuesto por la lectura se crea únicamente durante la confirmación y con revisión humana.

## Lectura asistida

La función `importar-factura`:

- exige sesión válida y perfil activo Propietario o Encargado;
- admite hasta 36 páginas JPG, PNG o WEBP preparadas desde imágenes o PDF;
- extrae cabecera, proveedor, cliente, vencimiento, pago, multi IVA, total y albaranes;
- conserva cada línea dentro de su albarán;
- no reconstruye líneas ausentes;
- devuelve avisos y marca como revisable cualquier incoherencia estructural o económica.

La lectura nunca confirma la factura ni modifica stock. La confirmación sigue siendo una acción humana explícita.

## Aceptación QA pendiente

La Preview debe comprobar al menos estos escenarios:

1. factura de servicio sin albaranes;
2. factura con dos albaranes nuevos y un mismo producto repetido;
3. factura con un albarán ya recibido y otro pendiente;
4. proveedor nuevo propuesto por IA;
5. dos tipos de IVA;
6. duplicado de factura;
7. albarán repetido, sin líneas o vinculado a otra factura;
8. descuadre del total;
9. almacén congelado;
10. doble pulsación o reintento de la misma confirmación.

# F7 · B11 en QA — frontera de pagos sin conexión

Fecha: 2026-10-08  
Entorno previsto para prueba manual: `L&A Suite QA`  
Estado: `CONTRATO_VERIFICADO; CORTE_RED_REAL_PENDIENTE`  
Producción: no tocada

## 1. Alcance comprobado

B11 mantiene desactivados los pagos offline. En modo sincronizado, el TPV solo
puede confirmar una operación mediante el backend. Sin conexión puede conservar
un borrador local visible, pero no debe registrar una venta, pago, reembolso,
movimiento de stock ni cierre con efectos compartidos.

No hay migraciones ni funciones remotas propias de B11 que aplicar.

## 2. Verificación del código activo

El contrato B11 se reforzó para inspeccionar directamente `fuente.js`, además
de la copia recuperada. Confirmó que:

1. `VentaRapida` recibe `venderCarritoA02`, que es la ruta activa del TPV;
2. `venderCarritoA02` exige que la nube y el cliente Supabase estén
   disponibles;
3. sin esa conexión devuelve un error que indica que no se registró nada
   localmente;
4. esa función no deriva a `venderLocal`;
5. un fallo del camino servidor de la venta heredada informa que no se ha
   descontado stock localmente;
6. el camino local heredado conserva `permitirDeficit: false`;
7. el borrador A06 está identificado como `BORRADOR_LOCAL` y es visible.

Esta comprobación sustituye la dependencia indirecta de una prueba PM07 que
comparaba fragmentos exactos de código y había quedado desactualizada por el
empaquetado actual.

## 3. Pruebas ejecutadas

```text
ABC_F4_B11_OFFLINE_BOUNDARY=PASS
A06_2_BACKEND_OPTIMISTIC_LOCK=PASS
A06_2_LOCAL_DRAFT_TTL_ISOLATION=PASS
A06_2_DRAFT_NO_CLIENT_PRICE_AUTHORITY=PASS
A06_2_CONFLICT_TYPED=PASS
A06_2_VISIBLE_CONFLICT_AND_DRAFT=PASS
A06_2_CONCURRENCY_LOCAL_DRAFTS=PASS
```

`node --check fuente.js` terminó sin errores.

## 4. Ensayo de navegador

Se intentó abrir el deploy preview de QA para ejecutar el corte de red desde
una sesión limpia. Netlify detuvo la navegación en `Team protection` antes de
cargar la aplicación. Por ello no se registra un corte de red real ni una
prueba visual del borrador en esta evidencia.

## 5. Resultado y límite pendiente

La frontera técnica queda verificada: el TPV sincronizado falla cerrado y no
presenta una operación local como cobro confirmado. La contingencia para un
terminal con autorización offline continúa documentada y desactivada.

Para completar la aceptación manual de B11 queda repetir el ensayo con acceso
al deploy preview: preparar un carrito, cortar la red antes de confirmar,
comprobar que solo queda el borrador y verificar que no cambian venta, pago ni
stock en el servidor.

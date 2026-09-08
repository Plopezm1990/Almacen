# PM13–P06 · Costes de personal

Base cerrada: PM13–P05 (`1ca001ce16b83e96c2af7c2f2feb90cea9655ed7`).

## Alcance

P06 no crea una nómina ni una segunda entidad de Personal. Reutiliza los campos ya persistidos por PM11/P01 (`salarioBrutoMensual`, `pagas`, `costeEmpresaMensual`, `fechaAlta`, `fechaBaja`) y corrige cómo Resultados consume esos datos.

## Reglas

- `costeEmpresaMensual` informado y válido = coste medio mensual exacto declarado por la empresa/gestoría.
- Si falta el coste exacto, la estimación es `bruto por paga × nº pagas / 12 × 1,32` y se etiqueta como estimada.
- Datos legados insuficientes no se inventan: el resultado se marca como incompleto.
- El coste de un periodo solo incluye los días que solapan con el intervalo real alta–baja del empleado.
- Un empleado dado de baja hoy sigue aportando coste a periodos históricos en los que trabajó.
- Un alta posterior no contamina periodos anteriores.
- Una baja legada sin fecha no recibe días ficticios de coste: queda como incompleta.
- El punto de equilibrio usa el equivalente mensual del propio periodo consultado.

## Fuera de alcance

- Cálculo legal de nóminas, IRPF o cotizaciones oficiales.
- Generación de nóminas por IA (PM13–P07).
- Cambios de esquema o nuevas RPC: P06 reutiliza la persistencia ya cerrada.
- Producción y `main`.

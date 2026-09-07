# PM13–P06 · Checkpoint final

- Base P05: `1ca001ce16b83e96c2af7c2f2feb90cea9655ed7`.
- Commit funcional P06: `66768ab64e7e579e9f275cf9484f74f8afb2a345`.
- Evidencia diagnóstica actualizada sin cambios funcionales: `8fe1f47401438047623a36f4f84e6a1673e67c76`.
- `main` verificado congelado en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.
- P06 no añade migraciones, tablas ni RPC: reutiliza los datos ya persistidos por Personal.
- QA: 0 migraciones P06; ficha QA existente conservada; no se realizaron escrituras de negocio.
- Producción: 0 migraciones P06 y ninguna escritura.

## Criterios cerrados

- Coste exacto mensual y coste estimado se distinguen explícitamente.
- La estimación anualiza correctamente el número de pagas antes de convertir a media mensual.
- Alta y baja delimitan el coste en periodos históricos.
- Altas futuras no contaminan periodos anteriores.
- Bajas actuales conservan su coste histórico cuando existe fecha de baja.
- Fichas legadas insuficientes se marcan como incompletas y no reciben importes inventados.
- Resultados usa el coste temporal del periodo y un equivalente mensual coherente para punto de equilibrio.
- P01–P05, PM10 Personal y PM12 P02–P10 forman parte del gate acumulativo.

El cierre exige un gate `SUCCESS` sobre este HEAD exacto y que el log confirme `Fuente ya coincide con P06`.

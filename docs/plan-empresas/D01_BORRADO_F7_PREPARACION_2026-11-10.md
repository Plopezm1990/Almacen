# D01 F7 — procedimiento de borrado definitivo

Fecha prevista: **10/11/2026**  
Estado: preparado; no ejecutar antes de esa fecha.

Este procedimiento sirve para cerrar la prueba de producción. El borrado se hará desde **Plataforma**, nunca mediante SQL manual. La aplicación debe mostrar que ha terminado el plazo de gracia antes de habilitar la confirmación final.

## Empresas incluidas

| Nombre | ID de empresa | Cuenta de dueño |
|---|---|---|
| Prueba D01 F7 A 20261010 | `empresa-706e41e7d2a65dfc` | `d01.f7.a.20261010@example.invalid` |
| Prueba D01 F7 B 20261010 | `empresa-93ec2338908c9302` | `d01.f7.b.20261010@example.invalid` |

No tocar `CHOCOLATERIA SAN GINES` (`empresa-034b3c08b4f4ae9b`), que es la empresa real activa.

## Comprobación previa de solo lectura

Antes de abrir el diálogo de borrado, confirmar en Plataforma:

- `1 empresa activa · 2 desactivadas`.
- A y B aparecen desactivadas desde el 11/10/2026.
- El botón **Eliminar para siempre…** ya no muestra el aviso de plazo de gracia.
- Las copias de producción y sus hashes siguen disponibles en la carpeta de seguridad del usuario.

## Borrado desde Plataforma

Para cada empresa ficticia:

1. Abrir **Eliminar para siempre…**.
2. Revisar que el nombre de la empresa coincide exactamente.
3. Confirmar el número de filas y cuentas mostrado por la aplicación.
4. Introducir la contraseña de administrador cuando la solicite.
5. Leer el aviso de irreversibilidad y confirmar solo esa empresa.
6. Guardar una captura del resultado antes de pasar a la siguiente.

El borrado definitivo es irreversible. Si el nombre, el número de filas o la fecha no coincide, cerrar el diálogo y parar.

## Verificación posterior de solo lectura

La comprobación debe confirmar:

- `CHOCOLATERIA SAN GINES` sigue siendo la única empresa activa.
- A y B ya no aparecen en `public.empresas`.
- No quedan filas de A/B en `public.almacen_kv`.
- No quedan movimientos de A/B en `public.movimientos_registro`.
- Las dos cuentas de dueño de prueba ya no existen en Auth.
- No hay filas huérfanas de `almacen_kv` ni de `movimientos_registro`.

Después se actualizarán `F7-DOS-EMPRESAS.md` y el informe de traspaso para marcar F7 y el plan D01 como cerrados.

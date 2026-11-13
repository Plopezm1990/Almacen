# Banco de pruebas de la capa de apariencia

Pagina aislada para comprobar `la-apariencia.css`, `la-apariencia.js` y
`la-apariencia-editor.js` **sin red y sin datos reales**: el contexto de empresa y
`window.storage` estan simulados en la propia pagina.

`docs/` queda fuera del artefacto publicado (`build-netlify-publish.mjs` lo excluye),
asi que este banco no llega a QA ni a produccion.

## Como ejecutarlo

Desde la raiz del repositorio, con cualquier servidor estatico que sirva la raiz:

    node -e "const h=require('http'),f=require('fs'),p=require('path');const t={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};h.createServer((q,s)=>{let x=q.url.split('?')[0];if(x==='/')x='/docs/rediseno/banco-apariencia/index.html';const r=p.join(process.cwd(),x);f.readFile(r,(e,d)=>{if(e){s.writeHead(404);return s.end();}s.writeHead(200,{'Content-Type':t[p.extname(r)]||'text/plain'});s.end(d);});}).listen(4173)"

y abrir `http://127.0.0.1:4173/`. Las rutas relativas `./la-apariencia.*` del banco
apuntan a su propia carpeta, asi que copia alli los tres archivos antes de servir, o
sirve la carpeta directamente tras copiarlos.

## Que comprueba

16 comprobaciones: los nueve disennos aplican tokens, los 54 pares disenno x paleta
los conservan, un disenno no registrado devuelve la interfaz base, las seis paletas
alcanzan el contraste exigido una vez resueltas, importar cinco HEX conserva el sexto
campo, importar cuatro se rechaza, la tinta del boton es legible, la revision se
incrementa, una revision obsoleta se rechaza, restaurar recupera la configuracion
anterior creando revision nueva, y la prueba temporal manda sobre la empresa y se
deshace al salir.

El resultado queda en `window.__banco` y escrito en la propia pagina.

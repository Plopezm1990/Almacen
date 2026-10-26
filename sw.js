// sw.js — shell de L&A Suite y notificaciones push.
//
// El service worker solo cachea recursos estáticos de la aplicación. Nunca
// intercepta POST/PUT/PATCH/DELETE ni peticiones a Supabase: sin red no se
// puede presentar una mutación server-side como confirmada.

// Se incrementa con cada cambio del shell para que un navegador que ya tenga
// una versión offline no siga ejecutando un bundle anterior después del
// deploy. El service worker nuevo precachea el shell completo y reclama el
// cliente durante la activación.
const CACHE_NAME = "la-suite-shell-v3";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/tailwind.generated.css",
  "/manifest.json",
  "/offline-shell-bootstrap.js",
  "/la-suite-icon.svg",
  "/la-suite-logo.svg",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/owner-bootstrap-prelock.js",
  "/reset-pruebas-preview.js",
  "/index-storage-bootstrap.js",
  "/server-authority-storage-bridge.js",
  "/index-loader.js",
  "/pm12-conteo-estados-v1.js",
  "/pm12-stock-atomico-v1.js",
  "/pm12-p09-historial-informes-movil-v1.js",
  "/edge-auth-patch.js",
  "/ui-context-bridge.js",
  "/plataforma-panel.js",
  "/owner-bootstrap-post-reset.js",
  "/fuente.js",
  "/pm11-compra-mobile-p10-v1.js",
  "/dashboard-premium-v2.js",
  "/index-mounted.js",
  "/restablecer-contrasena.html",
  "/restablecer-contrasena.js",
  "/sw.js"
];

const PRECACHE_PATHS = new Set(PRECACHE_URLS.map((url) => new URL(url, self.location.origin).pathname));

function esRecursoDeLaAplicacion(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && PRECACHE_PATHS.has(url.pathname);
}

function claveSinQuery(requestOrUrl) {
  const url = new URL(typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url, self.location.origin);
  return new Request(url.origin + url.pathname, { method: "GET" });
}

async function guardarRespuesta(cache, request, response) {
  if (response && response.ok) await cache.put(claveSinQuery(request), response.clone());
  return response;
}

async function responderNavegacion(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    return await guardarRespuesta(cache, request, await fetch(request));
  } catch (_error) {
    const cacheada = await cache.match(request, { ignoreSearch: true }) || await cache.match("/index.html");
    if (cacheada) return cacheada;
    return new Response(
      "<!doctype html><meta charset=\"utf-8\"><title>L&A Suite sin conexión</title>" +
        "<main style=\"font-family:system-ui;padding:2rem\"><h1>L&A Suite</h1>" +
        "<p>No hay conexión y todavía no existe una copia local de la aplicación. " +
        "Conéctate una vez para preparar el arranque offline.</p></main>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function responderRecurso(request) {
  const cache = await caches.open(CACHE_NAME);
  const cacheada = await cache.match(request, { ignoreSearch: true });
  if (cacheada) return cacheada;
  return guardarRespuesta(cache, request, await fetch(request));
}

self.addEventListener("install", function (evento) {
  evento.waitUntil((async function () {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE_URLS.map(async function (url) {
      const respuesta = await fetch(new Request(url, { cache: "no-store" }));
      if (!respuesta.ok) throw new Error("No se pudo precachear " + url + " (HTTP " + respuesta.status + ")");
      await cache.put(claveSinQuery(url), respuesta);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil((async function () {
    const claves = await caches.keys();
    await Promise.all(claves.filter((clave) => clave.startsWith("la-suite-shell-") && clave !== CACHE_NAME).map((clave) => caches.delete(clave)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", function (evento) {
  if (evento.data && evento.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function (evento) {
  const request = evento.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  const esNavegacion = request.mode === "navigate" || request.destination === "document";
  if (esNavegacion) {
    evento.respondWith(responderNavegacion(request));
    return;
  }

  if (esRecursoDeLaAplicacion(request)) evento.respondWith(responderRecurso(request));
});

self.addEventListener("push", function (evento) {
  let datos = { titulo: "L&A Suite", cuerpo: "Tienes una notificación nueva.", url: "/" };
  try {
    if (evento.data) datos = { ...datos, ...evento.data.json() };
  } catch (_error) {
    // Si el payload no viene en JSON válido, se muestra el mensaje genérico.
  }

  evento.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: datos.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", function (evento) {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || "/";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (listaClientes) {
      for (const cliente of listaClientes) {
        if (cliente.url.includes(self.location.origin) && "focus" in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

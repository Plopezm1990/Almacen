// sw.js — Service worker mínimo, solo para notificaciones push.
// No gestiona caché ni funcionamiento offline (eso ya lo cubre el manifest
// de la PWA por separado) — su único trabajo es recibir el push del
// servidor y mostrarlo, aunque la app esté cerrada.

self.addEventListener("push", function (evento) {
  let datos = { titulo: "L&A Suite", cuerpo: "Tienes una notificación nueva.", url: "/" };
  try {
    if (evento.data) datos = { ...datos, ...evento.data.json() };
  } catch (e) {
    // Si el payload no viene en JSON válido, se muestra el mensaje genérico de arriba.
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

// Al tocar la notificación, se abre (o se enfoca, si ya estaba abierta) la app.
self.addEventListener("notificationclick", function (evento) {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || "/";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (listaClientes) {
      for (const cliente of listaClientes) {
        if (cliente.url.includes(self.location.origin) && "focus" in cliente) {
          return cliente.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

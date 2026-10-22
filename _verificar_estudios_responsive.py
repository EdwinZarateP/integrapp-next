# Verificación responsive (2026-10-22) de /revision/estudios en móvil
# (375px): tras añadir la columna «Huellas» la tabla desbordaba la tarjeta.
# Fix: wrapper .rev-tabla-wrap (scroll horizontal interno) + min-width 980px.
# Comprueba con bounding boxes que la tabla NO se sale del contenedor padre
# en 375px, 600px y 1024px, y que el scroll del wrapper funciona.
import http.server
import socketserver
import threading
import json
from playwright.sync_api import sync_playwright

PUERTO = 8413
BASE = f"http://127.0.0.1:{PUERTO}/integrapp/revision/estudios"

FILA = {
    "placa": "AAA111", "estadoIntegra": "aprobado",
    "sujetos": [{"tipo": "persona", "documento": "111", "roles": ["conductor"], "autorizado": True}],
    "ultimo_estudio": "2025-01-01T00:00:00", "antiguedad_dias": 500,
    "vencida": True, "vigencia_vence": "2026-01-01T00:00:00",
    "tiene_corrida_vigente": True, "total_estudios": 1, "personas": 1,
    "pendientes_autorizacion": 0, "huellas_total": 1, "huellas_registradas": 1,
}
FILA2 = dict(FILA, placa="BBB222", huellas_total=2, huellas_registradas=0)
DATA = {"vehiculos": [FILA, FILA2], "vencidas": 1, "con_pendientes": 0, "sin_huellas": 1}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory="out", **kw)

    def translate_path(self, path):
        if path.startswith("/integrapp"):
            path = path[len("/integrapp"):] or "/"
        return super().translate_path(path)

    def log_message(self, *a):
        pass


with socketserver.TCPServer(("127.0.0.1", PUERTO), Handler) as httpd:
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        navegador = p.chromium.launch()
        ok = []
        for ancho in (375, 600, 1024):
            ctx = navegador.new_context(viewport={"width": ancho, "height": 800})
            ctx.add_cookies([
                {"name": "seguridadId", "value": "seg1", "url": f"http://127.0.0.1:{PUERTO}"},
                {"name": "seguridadNombre", "value": "EDWIN ZARATE", "url": f"http://127.0.0.1:{PUERTO}"},
                {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": f"http://127.0.0.1:{PUERTO}"},
            ])
            ctx.route("**/vehiculos/estudios-antiguedad*", lambda r: r.fulfill(
                status=200, content_type="application/json", body=json.dumps(DATA)))
            ctx.route("**/vehiculos/estudios-config*", lambda r: r.fulfill(
                status=200, content_type="application/json",
                body=json.dumps({"auto_disparo": True})))
            pagina = ctx.new_page()
            pagina.goto(BASE, wait_until="networkidle")
            pagina.wait_for_selector("table.rev-est-tabla")

            med = pagina.evaluate("""() => {
                const doc = document.documentElement;
                const tabla = document.querySelector('table.rev-est-tabla');
                const wrap = document.querySelector('.rev-tabla-wrap');
                const tarjeta = document.querySelector('.revx-tarjeta');
                const wb = wrap.getBoundingClientRect();
                const tr = tarjeta.getBoundingClientRect();
                return {
                    scrollAncho: doc.scrollWidth, ventana: window.innerWidth,
                    wrapDerecha: wb.right, wrapAncho: wb.width,
                    tarjetaDerecha: tr.right,
                    wrapScrollable: wrap ? wrap.scrollWidth > wrap.clientWidth : false,
                    tablaAncho: tabla.getBoundingClientRect().width,
                };
            }""")
            # Sin overflow del DOCUMENTO (nada "se sale del padre" visualmente)
            ok.append((f"[{ancho}px] documento sin scroll horizontal propio "
                       f"({med['scrollAncho']} <= {med['ventana']})",
                       med["scrollAncho"] <= med["ventana"] + 1))
            # Lo VISIBLE (el wrapper, que recorta la tabla) vive dentro de la tarjeta
            ok.append((f"[{ancho}px] wrapper dentro de la tarjeta "
                       f"(der {med['wrapDerecha']:.0f} <= {med['tarjetaDerecha']:.0f}+1)",
                       med["wrapDerecha"] <= med["tarjetaDerecha"] + 1))
            # La tabla conserva su ancho real (min-width) y el wrapper la recorta
            ok.append((f"[{ancho}px] tabla a su ancho real ({med['tablaAncho']:.0f}px) "
                       f"recortada por el wrapper ({med['wrapAncho']:.0f}px)",
                       med["tablaAncho"] > med["wrapAncho"]))
            if ancho <= 600:
                ok.append((f"[{ancho}px] wrapper con scroll interno "
                           f"(scrollWidth {med.get('wrapScrollable')})", med["wrapScrollable"]))
                pagina.locator(".rev-tabla-wrap").screenshot(path=f"_caps/estudios_responsive_{ancho}.png")
            ctx.close()
        navegador.close()

    fallaron = [n for n, paso in ok if not paso]
    for n, paso in ok:
        print(("OK " if paso else "NO "), n.encode("ascii", "replace").decode())
    print("\nRESULTADO:", "TODO OK" if not fallaron else f"FALLARON: {fallaron}")

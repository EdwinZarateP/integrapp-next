# Verificación de los 3 cambios de 2026-10-22 en /revision/estudios:
#   (1) Columna «Huellas» con chip ✓ N/N (verde) o ✗ N/N (rojo) por placa.
#   (2) Filtro «Solo sin huellas (N)» → manda solo_sin_huellas=true al backend
#       y la tabla muestra SOLO lo que devolvió el filtro.
#   (3) Encabezados ordenables: clic ordena asc → desc → sin orden (⇅).
import http.server
import socketserver
import threading
import json
from playwright.sync_api import sync_playwright

PUERTO = 8412
BASE = f"http://127.0.0.1:{PUERTO}/integrapp/revision/estudios"

TODAS = {
    "vehiculos": [
        # En orden de antigüedad (como los entrega el backend: más antiguo 1º).
        {"placa": "AAA111", "estadoIntegra": "aprobado",
         "sujetos": [{"tipo": "persona", "documento": "111", "roles": ["conductor"], "autorizado": True}],
         "ultimo_estudio": "2025-01-01T00:00:00", "antiguedad_dias": 500,
         "vencida": True, "vigencia_vence": "2026-01-01T00:00:00",
         "tiene_corrida_vigente": True, "total_estudios": 1, "personas": 1,
         "pendientes_autorizacion": 0, "huellas_total": 1, "huellas_registradas": 1},
        {"placa": "CCC333", "estadoIntegra": "registro_incompleto",
         "sujetos": [{"tipo": "vehiculo", "documento": "CCC333", "roles": ["vehículo"]}],
         "ultimo_estudio": "2026-01-01T00:00:00", "antiguedad_dias": 200,
         "vencida": False, "tiene_corrida_vigente": False, "total_estudios": 0,
         "personas": 0, "pendientes_autorizacion": 0,
         "huellas_total": 1, "huellas_registradas": None},
        {"placa": "BBB222", "estadoIntegra": "aprobado",
         "sujetos": [{"tipo": "persona", "documento": "222", "roles": ["conductor"], "autorizado": False}],
         "ultimo_estudio": "2026-06-01T00:00:00", "antiguedad_dias": 100,
         "vencida": False, "vigencia_vence": "2027-06-01T00:00:00",
         "tiene_corrida_vigente": True, "total_estudios": 1, "personas": 1,
         "pendientes_autorizacion": 1, "huellas_total": 2, "huellas_registradas": 0},
    ],
    "vencidas": 1, "con_pendientes": 1, "sin_huellas": 1,
}
FILTRADAS = {"vehiculos": [TODAS["vehiculos"][2]], "vencidas": 0,
             "con_pendientes": 1, "sin_huellas": 1}
pedidas = []


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
        ctx = navegador.new_context(viewport={"width": 1500, "height": 900})
        ctx.add_cookies([
            {"name": "seguridadId", "value": "seg1", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadNombre", "value": "EDWIN ZARATE", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": f"http://127.0.0.1:{PUERTO}"},
        ])

        def antiguedad(r):
            pedidas.append(r.request.url)
            data = FILTRADAS if "solo_sin_huellas=true" in r.request.url else TODAS
            r.fulfill(status=200, content_type="application/json", body=json.dumps(data))

        ctx.route("**/vehiculos/estudios-antiguedad*", antiguedad)
        ctx.route("**/vehiculos/estudios-config*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"auto_disparo": True})))

        pagina = ctx.new_page()
        pagina.goto(BASE, wait_until="networkidle")
        pagina.wait_for_selector("table.rev-est-tabla tbody tr")
        ok = []

        # (1) Columna Huellas con chips correctos por placa
        def celdas():
            return {fila.split("\t")[0].strip(): fila for fila in
                    pagina.locator("table.rev-est-tabla tbody tr").all_inner_texts()}

        filas = celdas()
        ok.append(("chip verde AAA111 (✓ 1/1)", "✓ 1/1" in filas["AAA111"]))
        ok.append(("chip rojo BBB222 (✗ 0/2)", "✗ 0/2" in filas["BBB222"]))
        ok.append(("sin respuesta CCC333", "sin respuesta" in filas["CCC333"]))
        ok.append(("orden default (antigüedad): AAA primero",
                   list(filas.keys()) == ["AAA111", "CCC333", "BBB222"]))

        # (3) Orden por encabezado: Placa asc
        pagina.get_by_role("cell", name="Placa").click()
        filas = celdas()
        ok.append(("orden Placa asc", list(filas.keys()) == ["AAA111", "BBB222", "CCC333"]))
        pagina.screenshot(path="_caps/estudios_huellas_orden_placa.png", full_page=False)
        pagina.get_by_role("cell", name="Placa").click()
        filas = celdas()
        ok.append(("orden Placa desc", list(filas.keys()) == ["CCC333", "BBB222", "AAA111"]))
        pagina.get_by_role("cell", name="Placa").click()
        filas = celdas()
        ok.append(("3er clic vuelve al orden por antigüedad",
                   list(filas.keys()) == ["AAA111", "CCC333", "BBB222"]))

        # Antigüedad: desc = más antiguo primero (500 > 200 > 100)
        pagina.get_by_role("cell", name="Antigüedad").click()  # asc: menos antiguo
        pagina.get_by_role("cell", name="Antigüedad").click()  # desc: más antiguo
        filas = celdas()
        ok.append(("orden Antigüedad desc (AAA de primero, 500 días)",
                   list(filas.keys()) == ["AAA111", "CCC333", "BBB222"]))

        # (2) Filtro «Solo sin huellas»
        antes = len(pedidas)
        pagina.get_by_text("Solo sin huellas (1)").click()
        pagina.get_by_role("button", name="Buscar").click()
        pagina.wait_for_timeout(600)
        ok.append(("el filtro manda solo_sin_huellas=true",
                   any("solo_sin_huellas=true" in u for u in pedidas[antes:])))
        filas = celdas()
        ok.append(("tabla filtrada: solo BBB222", list(filas.keys()) == ["BBB222"]))

        pagina.screenshot(path="_caps/estudios_huellas_filtro.png", full_page=False)
        navegador.close()

    fallaron = [nombre for nombre, paso in ok if not paso]
    for nombre, paso in ok:
        print(("OK " if paso else "NO "), nombre.encode("ascii", "replace").decode())
    print("\nRESULTADO:", "TODO OK" if not fallaron else f"FALLARON: {fallaron}")

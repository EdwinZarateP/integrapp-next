# Verificación 2026-10-21 (2ª tanda):
#   (6) La ✕ de limpiar NO se monta encima del botón «Buscar» (reporte del
#       usuario en las bandejas de /revision).
#   (5) El historial de estudios muestra la columna «Disparado por»: usuario
#       de Seguridad o «Automático (plataforma)»; corridas sin sello → «—».
import http.server
import socketserver
import threading
import json
from playwright.sync_api import sync_playwright

PUERTO = 8404
BASE = f"http://127.0.0.1:{PUERTO}/integrapp/revision/"

ESTUDIOS = [
    # Corrida vigente: automática (al pasar a revisión).
    {"id": "e1", "tipo": "persona", "cedula": "1020304050",
     "roles": ["conductor", "propietario"], "estado": "finalizado",
     "proveedor": "tusdatos", "hallazgo": False, "categoria": "",
     "reporte_id": "rep-auto", "canal": "automatico", "disparado_por": None,
     "iniciado_en": "2026-10-20T01:00:00", "finalizado_en": "2026-10-20T01:03:00"},
]
HISTORICO = [
    # Corrida vieja MANUAL por Seguridad y una aún más vieja SIN sello.
    {"id": "h1", "tipo": "persona", "cedula": "1020304050",
     "roles": ["conductor", "propietario"], "estado": "finalizado",
     "proveedor": "tusdatos", "hallazgo": True, "categoria": "medio",
     "reporte_id": "rep-manual", "canal": "manual",
     "disparado_por": "EDWIN ZARATE",
     "iniciado_en": "2026-09-10T14:00:00", "finalizado_en": "2026-09-10T14:02:00"},
    {"id": "h2", "tipo": "vehiculo", "placa": "JKU461", "estado": "finalizado",
     "proveedor": "tusdatos", "hallazgo": False, "categoria": "",
     "reporte_id": "rep-viejo",
     "iniciado_en": "2026-08-01T10:00:00", "finalizado_en": "2026-08-01T10:02:00"},
]

VEHICULOS = [
    {"_id": "v1", "placa": "JKU461", "estadoIntegra": "completado_revision",
     "condNombres": "JUAN", "condPrimerApellido": "PEREZ",
     "condCedulaCiudadania": "1020304050", "fechaEstado": "2026-10-20T01:00:00",
     "estudiosSeguridadAuto": ESTUDIOS},
]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory="out", **kw)

    def translate_path(self, path):
        if path.startswith("/integrapp"):
            path = path[len("/integrapp"):] or "/"
        return super().translate_path(path)

    def log_message(self, *a):
        pass


def solapan(a, b):
    return not (a["x"] + a["width"] <= b["x"] or b["x"] + b["width"] <= a["x"]
                or a["y"] + a["height"] <= b["y"] or b["y"] + b["height"] <= a["y"])


with socketserver.ThreadingTCPServer(("127.0.0.1", PUERTO), Handler) as httpd:
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        navegador = p.chromium.launch()
        ctx = navegador.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies([
            {"name": "seguridadId", "value": "seg1", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadNombre", "value": "EDWIN ZARATE", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": f"http://127.0.0.1:{PUERTO}"},
        ])
        ctx.route("**/vehiculos/obtener-vehiculos-incompletos*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"message": "ok", "vehicles": VEHICULOS})))
        ctx.route("**/vehiculos/estudios-seguridad/*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({
                "placa": "JKU461", "estudios": ESTUDIOS, "historico": HISTORICO,
                "documentos": [],
                "vigencia": {"desde": "2026-10-20T01:00:00", "vence": "2027-10-20T01:00:00"},
            })))
        ctx.route("**/vehiculos/obtener-aprobados-paginados*", lambda r: r.fulfill(
            status=200, content_type="application/json", body='{"vehiculos": []}'))

        pagina = ctx.new_page()
        pagina.goto(BASE + "?bandeja=revision", wait_until="load")
        pagina.wait_for_selector("text=JKU461", timeout=10000)

        # ═══ (6) La ✕ dentro del campo, sin montarse sobre «Buscar» ═════
        pagina.fill(".rev-input-busqueda", "JKU")
        pagina.wait_for_selector(".rev-btn-clear", timeout=3000)
        caja_x = pagina.locator(".rev-btn-clear").bounding_box()
        caja_buscar = pagina.locator(".rev-btn-buscar").bounding_box()
        caja_input = pagina.locator(".rev-input-busqueda").bounding_box()
        print(f"(6) ✕: {caja_x} | Buscar: {caja_buscar}")
        assert not solapan(caja_x, caja_buscar), "la ✕ se monta sobre el botón Buscar"
        # La ✕ vive DENTRO del input (a la derecha del texto, antes del botón).
        assert caja_x["x"] + caja_x["width"] <= caja_buscar["x"], "✕ fuera del campo"
        assert caja_x["x"] > caja_input["x"] + caja_input["width"] * 0.6, "✕ no está al final del campo"
        pagina.screenshot(path="_caps/buscador_x_buscar.png")
        print("(6) ✕ dentro del campo sin tocar «Buscar» OK")
        pagina.click(".rev-btn-clear")

        # ═══ (5) Columna «Disparado por» en el historial ════════════════
        pagina.click("text=JKU461")
        pagina.wait_for_selector(".rev-panel", timeout=10000)
        pagina.click(".rev-panel-pestana >> text=Estudios")
        pagina.wait_for_selector(".rev-est-tabla", timeout=10000)
        pagina.wait_for_timeout(400)
        encabezados = pagina.locator(".rev-est-tabla thead th").all_inner_texts()
        print("(5) encabezados:", encabezados)
        assert any("disparado por" in h.lower() for h in encabezados), "falta la columna Disparado por"
        origenes = [t.strip() for t in pagina.locator(".rev-est-origen").all_inner_texts()]
        print("(5) origenes:", origenes)
        assert "EDWIN ZARATE" in origenes, "no muestra el usuario manual"
        assert "Automático (plataforma)" in origenes, "no muestra el automático"
        assert "—" in origenes, "la corrida sin sello debería mostrar —"
        # La manual se distingue visualmente (violeta).
        assert pagina.locator(".rev-est-origen--manual").count() == 1
        pagina.screenshot(path="_caps/historial_disparado_por.png")
        navegador.close()

print("VERIFICACION OK")

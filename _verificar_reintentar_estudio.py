# Verificación del botón «Reintentar esta consulta» en tarjetas de estudio
# en ERROR (build estático + API moqueada, patrón _verificar_revision.py).
import http.server, socketserver, threading, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

PUERTO = 8417
BASE = f"http://127.0.0.1:{PUERTO}/integrapp/revision/"

ESTUDIOS = [
    {"id": "e1", "tipo": "persona", "cedula": "1035230023",
     "roles": ["conductor", "propietario"], "estado": "error",
     "proveedor": "tusdatos", "error": "TusDatos no entregó jobid",
     "error_proveedor": "{'error': 'falla iniciando la consulta'}",
     "iniciado_en": "2026-10-09T15:34:36"},
    {"id": "e2", "tipo": "vehiculo", "placa": "NNM001", "estado": "finalizado",
     "proveedor": "tusdatos", "hallazgo": None, "categoria": "",
     "fuentes": {"RUNT": False}, "reporte_id": "rep-9",
     "pdf_url": "https://firma/x.pdf", "finalizado_en": "2026-10-09T21:00:00"},
]

VEHICULOS = [{
    "_id": "v1", "placa": "NNM001", "estadoIntegra": "completado_revision",
    "condNombres": "FABER", "condPrimerApellido": "MADRID",
    "condCedulaCiudadania": "1035230023",
    "fechaEstado": "2026-10-09T15:01:51", "estudiosSeguridadAuto": ESTUDIOS}]

RESPUESTA_REINTENTO = {"capturado": False}

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
        nav = p.chromium.launch()
        ctx = nav.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies([
            {"name": "seguridadId", "value": "s1", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadNombre", "value": "EDWIN", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": f"http://127.0.0.1:{PUERTO}"},
        ])
        ctx.route("**/vehiculos/obtener-vehiculos-incompletos*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"message": "ok", "vehicles": VEHICULOS})))
        ctx.route("**/vehiculos/estudios-seguridad/*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"placa": "NNM001", "estudios": ESTUDIOS,
                             "historico": [], "documentos": [], "vigencia": None})))
        ctx.route("**/vehiculos/obtener-aprobados-paginados*", lambda r: r.fulfill(
            status=200, content_type="application/json", body='{"vehiculos": []}'))
        def _reintentar(ruta):
            RESPUESTA_REINTENTO["capturado"] = ruta.request.post_data
            ruta.fulfill(status=200, content_type="application/json",
                         body=json.dumps({"message": "Estudio re-consultado y finalizado.",
                                          "estudio": {**ESTUDIOS[0], "estado": "finalizado",
                                                      "reporte_id": "rep-77"}}))
        ctx.route("**/reintentar-estudio", _reintentar)

        pag = ctx.new_page()
        pag.goto(BASE + "?bandeja=revision&placa=NNM001&pestana=estudios",
                 wait_until="load")
        pag.wait_for_selector(".rev-est-card", timeout=10000)

        # El botón SOLO en la tarjeta en error
        botones = pag.locator("button:has-text('Reintentar esta consulta')")
        print("botones «Reintentar esta consulta»:", botones.count())
        assert botones.count() == 1, "solo la tarjeta en error lleva el botón"

        # La tarjeta finalizada NO lo tiene
        error_txt = pag.locator(".rev-est-error").inner_text()
        print("texto de error visible:", error_txt)
        assert "jobid" in error_txt

        # Click → POST al endpoint con el estudio_id correcto + Swal de éxito
        botones.first.click()
        pag.wait_for_selector(".swal2-popup", timeout=15000)
        swal = pag.locator(".swal2-title").inner_text()
        print("Swal:", swal, "| payload:", RESPUESTA_REINTENTO["capturado"])
        assert "recuperado" in swal.lower(), "Swal de éxito"
        assert "estudio_id" in str(RESPUESTA_REINTENTO["capturado"]) and "e1" in str(RESPUESTA_REINTENTO["capturado"]), "estudio_id correcto"

        pag.screenshot(path="_caps/reintentar_estudio.png")
        print("OK")
        nav.close()

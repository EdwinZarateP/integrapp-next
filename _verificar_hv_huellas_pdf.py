# Verificación (2026-10-22) del PDF de la HV: la cuadrícula de huellas
# restaurada PARTÍA la fila de la mano izquierda (título al final de la hoja 1,
# dedos en la hoja 2). Fix: wrap={false} por mano + cuadrícula compacta.
# Descarga la HV real (Playwright sobre out/ con las APIs moqueadas) y renderiza
# CADA hoja del PDF a PNG para inspección visual + chequeos de texto.
import base64
import http.server
import socketserver
import threading
import json
import fitz  # PyMuPDF
from playwright.sync_api import sync_playwright

PUERTO = 8414
BASE = f"http://127.0.0.1:{PUERTO}/integrapp/revision/?bandeja=aprobados&placa=JYN854"

# PNG 1x1 transparente en base64 (para huellas y firma — solo importa el layout)
PNG_B64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
           "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
PNG_DATA_URL = f"data:image/png;base64,{PNG_B64}"

VEH = {
    "_id": "v1", "placa": "JYN854", "estadoIntegra": "aprobado",
    "condNombres": "PRUEBA", "condPrimerApellido": "CONDUCTOR",
    "condCedulaCiudadania": "3199305",
    "vehModelo": "2019", "vehMarca": "CHEVROLET",
    "firmaUrl": PNG_DATA_URL,
    "fechaEstado": "2026-10-01T01:00:00",
    "documentos": {},
}


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
        ctx = navegador.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        ctx.add_cookies([
            {"name": "seguridadId", "value": "seg1", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadNombre", "value": "EDWIN ZARATE", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": f"http://127.0.0.1:{PUERTO}"},
        ])
        ctx.route("**/vehiculos/obtener-vehiculos-incompletos*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"message": "ok", "vehicles": [VEH]})))
        ctx.route("**/vehiculos/obtener-aprobados-paginados*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"vehiculos": [VEH], "total": 1})))
        ctx.route("**/vehiculos/obtener-firma*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"firma_b64": PNG_DATA_URL})))
        ctx.route("**/verificacion/obtener-huellas-pdf/*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"encontrado": True, "huellas": [PNG_DATA_URL] * 10})))

        pagina = ctx.new_page()
        pagina.goto(BASE, wait_until="networkidle")
        pagina.wait_for_selector("button.btn-descarga-pdf", timeout=20000)
        with pagina.expect_download(timeout=60000) as descarga:
            pagina.locator("button.btn-descarga-pdf").first.click()
        archivo = descarga.value
        ruta_pdf = "_caps/hv_jyn854.pdf"
        archivo.save_as(ruta_pdf)
        navegador.close()

doc = fitz.open(ruta_pdf)
print(f"Paginas del PDF: {len(doc)}")
ok = []
por_hoja = []
for i, page in enumerate(doc):
    texto = page.get_text()
    pix = page.get_pixmap(dpi=80)
    pix.save(f"_caps/hv_hoja_{i+1}.png")
    tiene = {
        "titulo_registro": "REGISTRO DACTILAR" in texto,
        "mano_der": "MANO DERECHA" in texto,
        "mano_izq": "MANO IZQUIERDA" in texto,
        "firma": "FIRMA:" in texto,
    }
    por_hoja.append(tiene)
    print(f"  hoja {i+1}: {tiene}")

# (1) El registro dactilar vive en página PROPIA (2026-10-22, pedido del
#     usuario): 2 hojas, TODO el apartado (título + manos + firma) en la 2ª.
ok.append(("el PDF tiene exactamente 2 hojas", len(doc) == 2))
ok.append(("hoja 1 SIN registro dactilar (queda para el formato)",
           not por_hoja[0]["titulo_registro"] and not por_hoja[0]["mano_der"]))
ok.append(("hoja 2 con TODO el apartado (título + 2 manos + firma)",
           por_hoja[1]["titulo_registro"] and por_hoja[1]["mano_der"]
           and por_hoja[1]["mano_izq"] and por_hoja[1]["firma"]))
# (2) El título «MANO IZQUIERDA» SIEMPRE comparte hoja con su fila de dedos:
#     en la MISMA hoja deben estar los 5 dedos de la izquierda (el texto de la
#     fila es una tira por caja: PULGAR ÍNDICE ... MEÑIQUE aparece 2 veces en
#     total, una por mano).
for i, tiene in enumerate(por_hoja):
    if tiene["mano_izq"]:
        texto = doc[i].get_text()
        ok.append((f"'MANO IZQUIERDA' en hoja {i+1} junto a sus dedos "
                   f"('MEÑIQUE' x2 presente)",
                   texto.count("MEÑIQUE") >= 1 and texto.count("PULGAR") >= 1))
# (3) Ninguna hoja tiene título de mano sin dedos al final (título huérfano):
for i in range(len(doc) - 1):
    texto = doc[i].get_text()
    if "MANO IZQUIERDA" in texto or "MANO DERECHA" in texto:
        ok.append((f"hoja {i+1}: cada título de mano va con SU fila (PULGAR+MEÑIQUE)",
                   "PULGAR" in texto and "MEÑIQUE" in texto))

fallaron = [n for n, paso in ok if not paso]
for n, paso in ok:
    print(("OK " if paso else "NO "), n.encode("ascii", "replace").decode())
print("\nRESULTADO:", "TODO OK" if not fallaron else f"FALLARON: {fallaron}")
print("Hojas renderizadas en _caps/hv_hoja_*.png para inspeccion visual")

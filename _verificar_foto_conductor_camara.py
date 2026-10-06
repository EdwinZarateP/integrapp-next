# Verifica que la FOTO DEL CONDUCTOR en paso 3 solo ofrezca «Tomar foto»
# (sin «Elegir Archivo» ni texto de archivo). API mockeada (incluida la URL
# de producción hardcodeada de ObtenerInfoPlaca).
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"
VEH = {"_id": "v1", "placa": "WOO453", "estadoIntegra": "registro_incompleto",
       "idUsuario": "u1", "fotos": [], "documentos": {}, "lecturasIA": {}}

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies([
        {"name": "conductorId", "value": "u1", "url": BASE},
        {"name": "conductorCorreo", "value": "JUAN@X.COM", "url": BASE},
        {"name": "conductorPerfil", "value": "CONDUCTOR", "url": BASE},
        {"name": "conductorPrimerNombre", "value": "JUAN", "url": BASE},
    ])
    page = ctx.new_page()
    for patron in ("**/vehiculos/obtener-vehiculo/**",
                   "https://integrappi-dvmh.onrender.com/vehiculos/obtener-vehiculo/**"):
        page.route(patron, lambda r: r.fulfill(status=200, content_type="application/json",
                                               body=json.dumps({"data": VEH})))
    page.route("**/vehiculos/obtener-vehiculos*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"message": "ok", "data": [VEH]})))

    page.goto(f"{BASE}/PanelConductores/?vista=flujo&paso=3&placa=WOO453",
              wait_until="networkidle")
    page.wait_for_timeout(1500)

    # Expandir la sección «2. Documentos del Conductor» (colapsada por defecto).
    page.click("text=2. Documentos del Conductor")
    page.wait_for_timeout(500)

    # El ítem «Foto Conductor» y su botón de carga.
    item = page.locator("div", has=page.locator("text=Foto Conductor")).first
    boton = page.locator("text=Foto Conductor").locator(
        "xpath=ancestor::div[.//button[contains(@class,'btn-doc-action')]][1]"
    ).locator("button.btn-doc-action.upload").first
    boton.click()
    page.wait_for_selector(".CargaDocumento-modal h2", timeout=8000)
    modal = page.locator(".CargaDocumento-modal").inner_text()
    tiene_tomar = "Tomar foto" in modal
    tiene_elegir = "Elegir Archivo" in modal
    tiene_input = page.locator(".CargaDocumento-modal #file-upload").count()
    print(f"[Foto Conductor] Tomar foto={tiene_tomar} · Elegir Archivo={tiene_elegir} · input file={tiene_input}")
    page.screenshot(path="_caps/foto_conductor_solo_camara.png")
    if not tiene_tomar:
        fallos.append("Foto Conductor sin botón «Tomar foto»")
    if tiene_elegir or tiene_input:
        fallos.append("Foto Conductor todavía ofrece elegir archivo")

    # Contraste: el SOAT (otro documento) sigue mostrando ambos botones.
    page.click("text=Cerrar")
    page.click("text=1. Documentos del Vehículo")
    page.wait_for_timeout(500)
    page.locator("text=SOAT").locator(
        "xpath=ancestor::div[.//button[contains(@class,'btn-doc-action')]][1]"
    ).locator("button.btn-doc-action.upload").first.click()
    page.wait_for_selector(".CargaDocumento-modal h2", timeout=8000)
    modal2 = page.locator(".CargaDocumento-modal").inner_text()
    print(f"[SOAT] Tomar foto={'Tomar foto' in modal2} · Elegir Archivo={'Elegir Archivo' in modal2}")
    if "Tomar foto" not in modal2 or "Elegir Archivo" not in modal2:
        fallos.append("el SOAT perdió sus dos opciones (debería mantenerlas)")

    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: Foto del Conductor solo con cámara; el resto igual.")

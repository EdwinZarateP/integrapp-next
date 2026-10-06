# Verifica la pestaña «Cambios» de /revision con datos: las tres secciones
# como TABLAS y el botón «Exportar a Excel» que descarga el .xlsx con las
# hojas esperadas. API mockeada.
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"

VEH = {
    "_id": "v1", "placa": "WOO453", "estadoIntegra": "completado_revision",
    "idUsuario": "507f1f77bcf86cd799439012",
    "condNombres": "JUAN", "condPrimerApellido": "PEREZ", "documentos": {},
    "historialCambios": [
        {"fecha": "2026-10-06T15:00:00", "usuario": "EDWIN", "seccion": "datos",
         "campos": [{"campo": "condCelular", "antes": "3001112233", "despues": "3009998877"},
                    {"campo": "vehColor", "antes": "BLANCO", "despues": "NEGRO"}]},
    ],
    "historialInactivacion": [
        {"fecha": "2026-09-20T10:00:00", "usuario": "EDWIN", "motivo": "SOAT vencido", "accion": "inactivo"},
    ],
    "auditoriaVehiculo": [
        {"fecha": "2026-10-06T15:00:00", "actor": "EDWIN", "via": "impersonacion",
         "accion": "datos_actualizados", "detalle": "2 campo(s)"},
        {"fecha": "2026-10-01T09:00:00", "actor": None, "via": "conductor",
         "accion": "documento_subido", "detalle": "soat"},
    ],
}

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    ctx.add_cookies([
        {"name": "seguridadId", "value": "s1", "url": BASE},
        {"name": "seguridadNombre", "value": "EDWIN", "url": BASE},
        {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": BASE},
    ])
    page = ctx.new_page()

    # Catch-all a nivel CONTEXTO (un page.route con glob dejó colar un request
    # al backend real en pruebas previas).
    import re
    def catch_all(route):
        url = route.request.url
        if "obtener-vehiculos-incompletos" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"message": "ok", "vehicles": [VEH]}))
        elif "obtener-aprobados-paginados" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"message": "ok", "vehicles": []}))
        else:
            route.continue_()

    ctx.route(re.compile(r"vehiculos"), catch_all)

    page.goto(f"{BASE}/revision/?bandeja=revision", wait_until="networkidle")
    page.wait_for_selector(".revx-nav-item", timeout=15000)
    page.click(".revx-nav-item:has-text('En revisión')")
    page.wait_for_selector("text=WOO453", timeout=15000)
    page.click("text=WOO453")
    page.wait_for_selector(".rev-panel", timeout=10000)
    page.click(".rev-panel-pestana:has-text('Cambios')")
    page.wait_for_timeout(600)

    tablas = page.locator(".rev-tabla-wrap table").count()
    boton = page.locator("text=Exportar a Excel").count()
    cuerpo = page.locator(".rev-panel").inner_text()
    print(f"[1] Tablas: {tablas} · Botón Excel: {boton}")
    page.screenshot(path="_caps/tabla_cambios.png", full_page=True)
    if tablas != 3:
        fallos.append(f"esperaba 3 tablas, hay {tablas}")
    if boton != 1:
        fallos.append("el botón «Exportar a Excel» no aparece")
    cuerpo_min = cuerpo.lower()
    for esperado in ["edwin", "seguridad (como el conductor)", "condcelular", "3001112233", "soat vencido"]:
        if esperado not in cuerpo_min:
            fallos.append(f"falta {esperado!r} en la pestaña")

    # Descarga del Excel.
    with page.expect_download(timeout=20000) as descarga:
        page.click("text=Exportar a Excel")
    d = descarga.value
    nombre = d.suggested_filename
    ruta = d.path()
    print(f"[2] Descarga: {nombre} ({ruta})")
    if not nombre.startswith("auditoria_WOO453_") or not nombre.endswith(".xlsx"):
        fallos.append(f"nombre inesperado: {nombre}")
    import zipfile
    with zipfile.ZipFile(ruta) as z:
        hojas = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
        print(f"[3] Hojas en el xlsx: {len(hojas)}")
        if len(hojas) != 3:
            fallos.append(f"el xlsx debería tener 3 hojas, tiene {len(hojas)}")

    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: tablas de cambios + exportación a Excel.")

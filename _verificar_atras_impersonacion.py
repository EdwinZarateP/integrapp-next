# Reproduce el reporte del usuario (2026-10-14):
# estar en /revision/?bandeja=actualizacion&placa=QVK730 → ir a
# /PanelConductores/?vista=flujo&paso=4&placa=QVK730 (Modo Seguridad) →
# ATRÁS debería devolver a la bandeja actualización CON el panel de QVK730
# abierto; en su lugar aterriza en ?bandeja=revision sin panel.
import json
import re
import sys
from playwright.sync_api import sync_playwright

BASE = __import__("os").environ.get("VERIFICAR_BASE", "http://localhost:3000/integrapp")

def vehiculo(placa, estado):
    return {"_id": placa, "placa": placa, "estadoIntegra": estado,
            "idUsuario": "u1", "condNombres": "JUAN", "condPrimerApellido": "PEREZ",
            "documentos": {}, "auditoriaVehiculo": []}

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies([
        {"name": "seguridadId", "value": "s1", "url": BASE},
        {"name": "seguridadNombre", "value": "EDWIN", "url": BASE},
        {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": BASE},
    ])
    page = ctx.new_page()

    def mock_incompletos(route):
        bandeja = re.search(r"bandeja=(\w+)", route.request.url)
        bandeja = bandeja.group(1) if bandeja else "revision"
        # El backend filtra por estado: actualizacion contiene a QVK730.
        lista = [vehiculo("QVK730", "en_actualizacion")] if bandeja == "actualizacion" \
            else [vehiculo("SZK344", "completado_revision")]
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"message": "ok", "vehicles": lista}))

    page.route("**/vehiculos/obtener-vehiculos-incompletos*", mock_incompletos)
    page.route("**/vehiculos/obtener-aprobados-paginados*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"vehiculos": [], "total": 0})))
    page.route("**/vehiculos/obtener-vehiculo/*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps(vehiculo("QVK730", "en_actualizacion"))))
    page.route("**/conductores/habeas-data*", lambda r: r.fulfill(status=200, content_type="application/json", body="{}"))
    page.route("**/vehiculos/estudios-seguridad/*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"estudios": [], "historico": [], "documentos": []})))

    # 1. Entrada directa: bandeja actualización + panel de QVK730.
    page.goto(f"{BASE}/revision/?bandeja=actualizacion&placa=QVK730", wait_until="commit")
    page.wait_for_selector(".rev-panel", timeout=15000)
    print("[1] Entrada directa: panel de QVK730 restaurado en bandeja actualizacion")
    page.wait_for_url(re.compile(r"bandeja=actualizacion&placa=QVK730"), timeout=5000)
    print(f"[2] URL antes de salir: {page.url}")

    # 2. Se va al panel del conductor (Modo Seguridad), como el usuario.
    page.goto(f"{BASE}/PanelConductores/?vista=flujo&paso=4&placa=QVK730", wait_until="commit")
    page.wait_for_timeout(1500)
    print(f"[3] En PanelConductores: {page.url}")

    # 3. ATRÁS.
    page.go_back(wait_until="commit")
    page.wait_for_timeout(2500)
    url_final = page.url
    panel_abierto = page.locator(".rev-panel").count() > 0
    print(f"[4] Tras ATRÁS: url={url_final} panel_abierto={panel_abierto}")

    if "bandeja=actualizacion" not in url_final or "placa=QVK730" not in url_final:
        fallos.append(f"atrás no restauró la URL: {url_final}")
    if not panel_abierto:
        fallos.append("atrás no re-abrió el panel de QVK730")

    browser.close()

if fallos:
    print("\nFALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("\nOK: atrás vuelve a ?bandeja=actualizacion&placa=QVK730 con el panel abierto")

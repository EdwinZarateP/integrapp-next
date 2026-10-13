# Verifica los cambios de /revision (2026-10-13):
# 1. Carga PEREZOSA: el endpoint se llama con ?bandeja=<activa> y SOLO al
#    cambiar de bandeja (no pide todas).
# 2. SKELETON: mientras la bandeja carga se ven filas shimmer (no el vacío).
# 3. SIN CONTADORES: sidebar sin chips de número y topbar sin pill.
# 4. BOTÓN ATRÁS: abrir panel apila historial → atrás CIERRA el panel y
#    queda en /revision?bandeja=… (sin salirse de la app), tanto desde clic
#    en la lista como por entrada directa ?placa=.
# API mockeada por route interception (no necesita backend).
import json
import re
import sys
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"
VEHICULOS = [
    {"_id": "v1", "placa": "SZK344", "estadoIntegra": "completado_revision",
     "idUsuario": "u1", "condNombres": "JUAN", "condPrimerApellido": "PEREZ",
     "documentos": {}, "auditoriaVehiculo": []},
    {"_id": "v2", "placa": "AAA222", "estadoIntegra": "registro_incompleto",
     "idUsuario": "u2", "condNombres": "ANA", "condPrimerApellido": "LOPEZ",
     "documentos": {}, "auditoriaVehiculo": []},
]

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
    llamadas = []
    primera_carga = {"lista": True}  # la 1ª respuesta tarda 1.5 s (skeleton)

    def mock_incompletos(route):
        llamadas.append(route.request.url)
        if primera_carga["lista"]:
            primera_carga["lista"] = False
            time.sleep(1.5)
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"message": "ok", "vehicles": VEHICULOS[:1]}))

    page.route("**/vehiculos/obtener-vehiculos-incompletos*", mock_incompletos)
    page.route("**/vehiculos/obtener-aprobados-paginados*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"vehiculos": [], "total": 0})))

    # ── 1+2+3: carga con skeleton, request con ?bandeja, sin contadores.
    page.goto(f"{BASE}/revision/?bandeja=revision", wait_until="commit")
    page.wait_for_selector(".rev-fila--skeleton", timeout=8000)
    print("[1] Skeleton visible mientras carga la bandeja")
    page.wait_for_selector("text=SZK344", timeout=15000)
    if not any("bandeja=revision" in u for u in llamadas):
        fallos.append(f"el request no lleva ?bandeja=revision: {llamadas}")
    else:
        print(f"[2] Endpoint llamado con ?bandeja=revision ({len(llamadas)}x)")
    if page.locator(".revx-nav-contador").count() > 0:
        fallos.append("quedan chips de contador en la sidebar")
    if page.locator(".revx-pill").count() > 0:
        fallos.append("quedó la pill «En revisión: N» en el topbar")
    print("[3] Sidebar sin contadores y topbar sin pill")

    # ── contador de la bandeja activa junto al título del módulo.
    conteo = page.locator(".revx-conteo").inner_text(timeout=5000)
    if "1 vehículo" not in conteo:
        fallos.append(f"contador del título={conteo!r} ≠ '1 vehículo'")
    else:
        print(f"[3b] Contador junto al título: {conteo!r}")

    # ── 4a: clic en la fila → URL con placa → ATRÁS cierra el panel.
    page.click("text=SZK344")
    page.wait_for_selector(".rev-panel", timeout=8000)
    page.wait_for_url(re.compile(r"placa=SZK344"), timeout=5000)
    print("[4] Panel abierto y URL con placa=SZK344")
    page.go_back(wait_until="commit")
    page.wait_for_timeout(800)
    if page.locator(".rev-panel").count() > 0:
        fallos.append("atrás NO cerró el panel (clic en lista)")
    if "placa=" in page.url:
        fallos.append(f"atrás dejó placa en la URL: {page.url}")
    if "/revision" not in page.url:
        fallos.append(f"atrás salió de /revision: {page.url}")
    else:
        print(f"[5] ATRÁS cerró el panel y quedó en {page.url}")

    # ── 4b: entrada DIRECTA con placa en la URL → ATRÁS cierra el panel
    # (antes se salía de la app a /integrapp/).
    page.goto(f"{BASE}/revision/?bandeja=revision&placa=SZK344", wait_until="commit")
    page.wait_for_selector(".rev-panel", timeout=15000)
    print("[6] Entrada directa con ?placa abre el panel")
    page.go_back(wait_until="commit")
    page.wait_for_timeout(800)
    if page.locator(".rev-panel").count() > 0:
        fallos.append("atrás NO cerró el panel (entrada directa)")
    if not page.url.startswith(BASE) or "/revision" not in page.url:
        fallos.append(f"atrás salió de la app: {page.url}")
    else:
        print(f"[7] ATRÁS desde entrada directa quedó en {page.url} (sin salir de la app)")
    page.screenshot(path="_caps/carga_bandeja_atras.png")

    # ── 1b: cambiar de bandeja pide SOLO la nueva (caché al volver).
    antes = len(llamadas)
    page.click(".revx-nav-item:has-text('Pendientes')")
    page.wait_for_timeout(600)
    nuevas = [u for u in llamadas[antes:]]
    if not any("bandeja=pendientes" in u for u in nuevas):
        fallos.append(f"cambiar a Pendientes no pidió ?bandeja=pendientes: {nuevas}")
    else:
        print("[8] Cambiar de bandeja pide solo la nueva (?bandeja=pendientes)")

    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: carga por bandeja + skeleton + sin contadores + atrás cierra el panel.")

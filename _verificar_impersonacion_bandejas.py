# Verifica el Modo Seguridad desde las bandejas de /revision (2026-10-06):
# 1. /revision con sesión seguridad* → abre un vehículo → botón violeta
#    «Abrir panel del conductor» en el header del panel.
# 2. Click → Swal de confirmación → login-como (mockeado) → panel del
#    conductor con perfil «🕵 Seguridad» y el ítem «Volver a Seguridad».
# 3. Ese ítem limpia las cookies de conductor y regresa a /revision.
# API mockeada por route interception (no necesita backend).
import json
import re
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"
CUENTA_ID = "507f1f77bcf86cd799439012"

VEHICULO = {
    "_id": "v1", "placa": "WOO453", "estadoIntegra": "completado_revision",
    "idUsuario": CUENTA_ID,
    "condNombres": "JUAN", "condPrimerApellido": "PEREZ",
    "documentos": {}, "auditoriaVehiculo": [],
}
LOGIN_COMO = {
    "usuario": {"id": CUENTA_ID, "correo": "JUAN@X.COM", "perfil": "TENEDOR",
                "primerNombre": "JUAN"},
    "impersonado_por": "EDWIN", "politicas_pendientes": False,
}

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
  # Sesión de Seguridad (cookies del login de la Torre de Control).
    ctx.add_cookies([
        {"name": "seguridadId", "value": "s1", "url": BASE},
        {"name": "seguridadNombre", "value": "EDWIN", "url": BASE},
        {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": BASE},
    ])
    page = ctx.new_page()
    login_como_llamado = []

    def mock_login_como(route):
        login_como_llamado.append(route.request.url)
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps(LOGIN_COMO))

    page.route("**/conductores/login-como/**", mock_login_como)
    page.route("**/vehiculos/obtener-vehiculos-incompletos",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"message": "ok", "vehicles": [VEHICULO]})))
    page.route("**/vehiculos/obtener-aprobados-paginados*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"message": "ok", "vehicles": []})))

    page.goto(f"{BASE}/revision/?bandeja=pendientes", wait_until="networkidle")
    # En dev, StrictMode re-monta los efectos y el espejo de URL revierte la
    # bandeja restaurada (en prod no pasa): entramos a Pendientes con click.
    page.wait_for_selector(".revx-nav-item", timeout=15000)
    page.click(".revx-nav-item:has-text('Pendientes')")
    # Abrir el panel de detalle de la placa.
    page.wait_for_selector("text=WOO453", timeout=15000)
    page.click("text=WOO453")
    page.wait_for_selector(".rev-panel-impersonar", timeout=10000)
    print("[1] Botón «Abrir panel del conductor» visible en el header del panel")

    # Confirmación → impersonación.
    page.click(".rev-panel-impersonar")
    page.wait_for_selector("text=Entrar como Seguridad", timeout=5000)
    print("[2] Swal de confirmación presente")
    page.click("text=Entrar como Seguridad")
    page.wait_for_url(re.compile(r"PanelConductores"), timeout=30000, wait_until="commit")
    page.wait_for_timeout(2500)  # hidratación del panel en dev
    cookies = {c["name"]: c["value"] for c in ctx.cookies(BASE)}
    if cookies.get("conductorImpersonadoPor") != "EDWIN":
        fallos.append(f"cookie impersonado={cookies.get('conductorImpersonadoPor')!r} ≠ EDWIN")
    if not any("login-como" in u for u in login_como_llamado):
        fallos.append("no se llamó a /conductores/login-como")
    perfil = page.locator(".barra-userPerfil").inner_text()
    print(f"[3] Panel del conductor: perfil={perfil!r} · login-como llamado={len(login_como_llamado)}x")
    if "seguridad" not in perfil.lower():
        fallos.append(f"perfil {perfil!r} no muestra Modo Seguridad")

    # Menú del header → «Volver a Seguridad» (cerrando antes el popup de
    # entrada del Modo Seguridad, que sale una vez por sesión/conductor).
    page.click("text=Entendido", timeout=10000)
    page.click(".barra-userBtn")
    page.wait_for_selector("text=Volver a Seguridad", timeout=5000)
    print("[4] Ítem «Volver a Seguridad» en el dropdown")
    page.click("text=Volver a Seguridad")
    page.wait_for_url(re.compile(r"/revision"), timeout=30000, wait_until="commit")
    page.wait_for_timeout(2500)
    cookies2 = {c["name"]: c["value"] for c in ctx.cookies(BASE)}
    if "conductorImpersonadoPor" in cookies2:
        fallos.append("la cookie de impersonación sigue viva tras Volver a Seguridad")
    if cookies2.get("seguridadNombre") != "EDWIN":
        fallos.append("las cookies de Seguridad se perdieron")
    print("[5] Volvió a /revision con sesión de Seguridad intacta")
    page.screenshot(path="_caps/impersonacion_bandejas.png")

    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: impersonación desde bandejas + regreso a /revision.")

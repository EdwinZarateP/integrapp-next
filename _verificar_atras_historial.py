# Verifica el fix de 2026-10-14 (atrás desde el Modo Seguridad a /revision):
# 1. SIN PARPADEO: al volver de /PanelConductores con atrás, la URL conserva
#    &placa=… TODO el tiempo (antes el espejo la borraba al montar y la placa
#    "reaparecía" cuando la data llegaba).
# 2. SIN FETCH DE BANDEJA: la caché de sessionStorage reabre el panel al
#    instante (no se re-consulta la bandeja completa al remontar).
# 3. SIN ENTRADA FANTASMA: restaurar el panel NO hace pushState (spy sobre
#    history.pushState) — cada round-trip Seguridad→atrás sumaba una entrada.
# 4. ATRÁS desde el panel restaurado → lista sin placa, dentro de /revision.
# 5. ADELANTE vuelve a abrir el panel (entrada reutilizada, sin pushState).
# 6. REGRESIÓN F5: entrada directa con ?placa= → atrás cierra el panel a la
#    lista SIN salir de la app (fix 2026-10-13 intacto).
# 7. RONDA 2 — CACHÉ FRÍA: con la bandeja LENTA (2.5 s) y la consulta
#    individual ?placa= instantánea, el panel abre SIN esperar la bandeja
#    completa (reporte del usuario: "carga todas las otras placas y eso es
#    lo que hace lenta la carga cuando regresa").
# Flujo real: clic en la fila → «Abrir panel del conductor» (login-como
# mockeado) → navegación client-side a /PanelConductores (mismo documento,
# como el usuario) → ATRÁS del navegador.
import io
import json
import re
import sys
import time
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = __import__("os").environ.get("VERIFICAR_BASE", "http://localhost:3000/integrapp")
CUENTA_ID = "507f1f77bcf86cd799439012"
PLACA = "SPL276"

VEHICULO = {
    "_id": "v1", "placa": PLACA, "estadoIntegra": "completado_revision",
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
    ctx.add_cookies([
        {"name": "seguridadId", "value": "s1", "url": BASE},
        {"name": "seguridadNombre", "value": "EDWIN", "url": BASE},
        {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": BASE},
    ])
    page = ctx.new_page()
    bandeja_reqs = []   # consultas de bandeja completa
    placa_reqs = []     # consultas individuales ?placa= (instantáneas)
    # Ronda 2: la bandeja FALLA al instante (abort) — el panel debe abrir con
    # la consulta individual aunque la bandeja nunca llegue. (No se puede
    # simular "bandeja lenta" con time.sleep: la API sync de Playwright corre
    # en un solo hilo y el sleep bloquearía TAMBIÉN la respuesta de la placa.)
    bandeja_rota = {"on": False}

    def mock_incompletos(route):
        params = parse_qs(urlparse(route.request.url).query)
        if params.get("placa"):
            placa_reqs.append(route.request.url)
            lista = [VEHICULO] if params["placa"][0].upper() == PLACA else []
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"message": "ok", "vehicles": lista}))
            return
        bandeja_reqs.append(route.request.url)
        if bandeja_rota["on"]:
            route.abort("connectionfailed")
            return
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"message": "ok", "vehicles": [VEHICULO]}))

    page.route("**/vehiculos/obtener-vehiculos-incompletos*", mock_incompletos)
    page.route("**/vehiculos/obtener-aprobados-paginados*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"vehiculos": [], "total": 0})))
    page.route("**/conductores/login-como/**",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps(LOGIN_COMO)))

    # ── Escenario: bandeja → clic placa → panel apilado.
    page.goto(f"{BASE}/revision/?bandeja=revision", wait_until="commit")
    page.wait_for_selector(f"text={PLACA}", timeout=15000)
    page.click(f"text={PLACA}")
    page.wait_for_selector(".rev-panel", timeout=8000)
    page.wait_for_url(re.compile(rf"placa={PLACA}"), timeout=5000)
    print(f"[1] Clic en {PLACA}: panel abierto, URL={page.url}")

    # ── Modo Seguridad: impersonar por la UI (navegación CLIENT-SIDE).
    page.wait_for_selector(".rev-panel-impersonar", timeout=8000)
    page.click(".rev-panel-impersonar")
    page.wait_for_selector("text=Entrar como Seguridad", timeout=5000)
    page.click("text=Entrar como Seguridad")
    page.wait_for_url(re.compile(r"PanelConductores"), timeout=30000, wait_until="commit")
    page.wait_for_timeout(2000)  # hidratación del panel del conductor
    print(f"[2] Modo Seguridad: {page.url}")

    # Antes de ATRÁS: contar fetches y espiar pushState.
    bandeja_antes = len(bandeja_reqs)
    page.evaluate("""() => {
      window.__pushes = 0;
      const orig = history.pushState.bind(history);
      history.pushState = (...args) => { window.__pushes++; return orig(...args); };
    }""")

    # ── ATRÁS: muestrear la URL buscando el parpadeo (placa borrada y vuelta).
    page.go_back(wait_until="commit")
    url_sin_placa = None
    for _ in range(60):  # ~3 s muestreando cada 50 ms
        page.wait_for_timeout(50)
        if "placa=" not in page.url:
            url_sin_placa = page.url
            break
    page.wait_for_selector(".rev-panel", timeout=8000)
    page.wait_for_timeout(500)  # dejar asentar espejo + efectos
    url_final = page.url
    pushes = page.evaluate("() => window.__pushes")
    panel_abierto = page.locator(".rev-panel").count() > 0
    bandeja_despues = len(bandeja_reqs)
    print(f"[3] Tras ATRÁS: url={url_final} panel={panel_abierto} "
          f"pushState={pushes} bandejas_nuevas={bandeja_despues - bandeja_antes} "
          f"placa_reqs={len(placa_reqs)}")

    if url_sin_placa:
        fallos.append(f"parpadeo: la URL perdió la placa ({url_sin_placa})")
    else:
        print("[3b] Sin parpadeo: la placa nunca salió de la URL")
    if "placa=" not in url_final or "bandeja=revision" not in url_final:
        fallos.append(f"atrás no restauró panel: {url_final}")
    if not panel_abierto:
        fallos.append("atrás no re-abrió el panel")
    if bandeja_despues != bandeja_antes:
        fallos.append(f"caché sessionStorage falló: {bandeja_despues - bandeja_antes} bandeja(s) extra")
    if pushes != 0:
        fallos.append(f"restaurar el panel hizo {pushes} pushState (entrada fantasma)")

    # ── ATRÁS de nuevo: cierra el panel → lista sin placa, dentro de /revision.
    page.go_back(wait_until="commit")
    page.wait_for_timeout(800)
    if page.locator(".rev-panel").count() > 0:
        fallos.append("atrás desde el panel restaurado no lo cerró")
    if "placa=" in page.url:
        fallos.append(f"atrás dejó placa en la URL: {page.url}")
    if "/revision" not in page.url:
        fallos.append(f"atrás salió de /revision: {page.url}")
    else:
        print(f"[4] ATRÁS desde el panel restaurado → lista: {page.url}")

    # ── ADELANTE: reabre el panel con la entrada reutilizada (sin pushState).
    page.go_forward(wait_until="commit")
    page.wait_for_selector(".rev-panel", timeout=8000)
    pushes_fwd = page.evaluate("() => window.__pushes")
    if "placa=" not in page.url:
        fallos.append(f"adelante no reabrió el panel: {page.url}")
    elif pushes_fwd != 0:
        fallos.append(f"adelante re-apiló el panel ({pushes_fwd} pushState)")
    else:
        print(f"[5] ADELANTE reabrió el panel sin pushState: {page.url}")

    # ── REGRESIÓN F5 (documento nuevo: convert+push de 2026-10-13 intacto).
    page2 = ctx.new_page()
    page2.route("**/vehiculos/obtener-vehiculos-incompletos*", mock_incompletos)
    page2.route("**/vehiculos/obtener-aprobados-paginados*",
                lambda r: r.fulfill(status=200, content_type="application/json",
                                    body=json.dumps({"vehiculos": [], "total": 0})))
    page2.goto(f"{BASE}/revision/?bandeja=revision&placa={PLACA}", wait_until="commit")
    page2.wait_for_selector(".rev-panel", timeout=15000)
    print("[6] F5/entrada directa con ?placa abre el panel")
    page2.go_back(wait_until="commit")
    page2.wait_for_timeout(800)
    if page2.locator(".rev-panel").count() > 0:
        fallos.append("atrás NO cerró el panel (entrada directa)")
    if not page2.url.startswith(BASE) or "/revision" not in page2.url:
        fallos.append(f"atrás salió de la app: {page2.url}")
    else:
        print(f"[7] ATRÁS desde entrada directa quedó en {page2.url} (sin salir de la app)")
    page2.close()

    # ── RONDA 2 — CACHÉ FRÍA: la bandeja FALLA (abort); el panel debe abrir
    #    con la consulta individual ?placa= SIN depender de la bandeja
    #    (pedido del usuario: traer todas las placas era lo lento).
    page3 = ctx.new_page()
    page3.route("**/vehiculos/obtener-vehiculos-incompletos*", mock_incompletos)
    page3.route("**/vehiculos/obtener-aprobados-paginados*",
                lambda r: r.fulfill(status=200, content_type="application/json",
                                    body=json.dumps({"vehiculos": [], "total": 0})))
    bandeja_rota["on"] = True
    t0 = time.time()
    page3.goto(f"{BASE}/revision/?bandeja=revision&placa={PLACA}", wait_until="commit")
    try:
        page3.wait_for_selector(".rev-panel", timeout=3000)
        dt = time.time() - t0
        print(f"[8] Caché fría: panel abierto en {dt:.2f} s con la bandeja ROTA")
        if not placa_reqs:
            fallos.append("no se usó la consulta individual ?placa=")
    except Exception:
        fallos.append("caché fría: el panel no abrió sin la bandeja (consulta individual falló)")
    page3.screenshot(path="_caps/atras_historial_fria.png")
    bandeja_rota["on"] = False
    page3.close()

    page.screenshot(path="_caps/atras_historial.png")
    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: atrás sin parpadeo/fetch/entrada fantasma; F5 intacto; "
      "caché fría abre el panel sin esperar la bandeja completa.")

import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
COOKIES = [
    {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "CONDUCTOR", "domain": "localhost", "path": "/"},
]
VEH = {"placa": "WOO453", "estadoIntegra": "registro_incompleto",
       "condCertificacionBancaria": None,
       "tenedCertificacionBancaria": "Vehiculos/WOO453/2026-10-01/tenedCertificacionBancaria.pdf",
       "lecturasIA": {}, "fotos": []}

with sync_playwright() as p:
    n = p.chromium.launch()
    ctx = n.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies(COOKIES)
    pag = ctx.new_page()
    pag.on("pageerror", lambda e: print("PAGEERROR:", str(e)[:300]))
    pag.on("console", lambda m: print("console-error:", m.text[:200]) if m.type == "error" else None)

    def ruta(route, request):
        if "obtener-vehiculo" in request.url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"data": VEH}))
        elif "/vehiculos/" in request.url:
            route.fulfill(status=200, content_type="application/json", body='{"message":"ok","vehiculos":[]}')
        else:
            route.continue_()

    pag.route("**/vehiculos/**", ruta)
    pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=2&placa=WOO453", wait_until="networkidle")
    pag.wait_for_timeout(2000)
    estado = pag.evaluate("""() => ({
        titulo: document.querySelector('h2') && document.querySelector('h2').textContent,
        texto: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300),
        nBotones: document.querySelectorAll('button').length,
    })""")
    print(json.dumps(estado, ensure_ascii=False))
    n.close()

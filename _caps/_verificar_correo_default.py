"""Verifica el prellenado del correo de la cuenta en el paso 2:
- CONDUCTOR → condCorreo = correo de la cookie (si el campo viene vacío).
- TENEDOR → tenedCorreo = correo de la cookie.
- No pisa un correo ya guardado."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
PLACA = "Vehiculos/WOO453/2026-10-01/x.webp"
CASOS = [
    ("conductor_vacio", "CONDUCTOR", {"placa": "WOO453", "estadoIntegra": "registro_incompleto"}),
    ("tenedor_vacio", "TENEDOR", {"placa": "WOO453", "estadoIntegra": "registro_incompleto"}),
    ("no_pisa_guardado", "CONDUCTOR",
     {"placa": "WOO453", "estadoIntegra": "registro_incompleto", "condCorreo": "GUARDADO@X.COM"}),
]

with sync_playwright() as p:
    n = p.chromium.launch()
    for nombre, perfil, veh in CASOS:
        ctx = n.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies([
            {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
            {"name": "conductorPerfil", "value": perfil, "domain": "localhost", "path": "/"},
            {"name": "conductorCorreo", "value": "mitipo@correo.com", "domain": "localhost", "path": "/"},
        ])
        pag = ctx.new_page()

        def ruta(route, _request, _veh=veh):
            if "obtener-vehiculo" in _request.url:
                route.fulfill(status=200, content_type="application/json",
                              body=json.dumps({"data": _veh}))
            elif "/vehiculos/" in _request.url:
                route.fulfill(status=200, content_type="application/json",
                              body='{"message":"ok","vehiculos":[]}')
            else:
                route.continue_()

        pag.route("**/vehiculos/**", ruta)
        pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=2&placa=WOO453",
                 wait_until="networkidle")
        pag.wait_for_timeout(1500)
        info = pag.evaluate("""() => {
            const get = name => {
                const el = document.querySelector(`[name="${name}"]`);
                return el ? el.value : null;
            };
            return { condCorreo: get('condCorreo'), tenedCorreo: get('tenedCorreo') };
        }""")
        print(nombre, "->", info)
        ctx.close()
    n.close()
print("OK")

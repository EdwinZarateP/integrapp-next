"""Verificación del «es la misma persona» para certificado bancario
conductor↔tenedor (ambas direcciones), contra el build estático en :3100."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
COOKIES = [
    {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "CONDUCTOR", "domain": "localhost", "path": "/"},
]

CASOS = [
    ("conductor_(tenedor_cargado)", "Cert. bancario conductor",
     {"condCertificacionBancaria": None,
      "tenedCertificacionBancaria": "Vehiculos/WOO453/2026-10-01/tenedCertificacionBancaria.pdf"}),
    ("tenedor_(conductor_cargado)", "Cert. bancario tenedor",
     {"condCertificacionBancaria": "Vehiculos/WOO453/2026-10-01/condCertificacionBancaria.pdf",
      "tenedCertificacionBancaria": None}),
]

with sync_playwright() as p:
    n = p.chromium.launch()
    for nombre, boton, campos in CASOS:
        veh = {"placa": "WOO453", "estadoIntegra": "registro_incompleto",
               "lecturasIA": {}, "fotos": [], **campos}
        ctx = n.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies(COOKIES)
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
        pag.locator("button", has_text=boton).first.click()
        pag.wait_for_timeout(700)
        info = pag.evaluate("""() => {
            const s = document.querySelector('.swal2-popup');
            if (!s) return { haySwal: false };
            return {
                titulo: s.querySelector('h2') && s.querySelector('h2').textContent,
                html: s.querySelector('.swal2-html-container').textContent.slice(0, 80),
                botones: [...s.querySelectorAll('.swal2-actions button')].map(b => b.textContent.trim()),
            };
        }""")
        print(nombre, "->", info)
        ctx.close()
    n.close()
print("OK")

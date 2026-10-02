"""Verificación de la barra de avance sticky del paso 2 (Datos):
escritorio debe quedar pegada al borde superior (top=0) y en móvil debajo
de la fila de píldoras. Requiere el export servido con _servir_estatico.py."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
COOKIES = [
    {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "CONDUCTOR", "domain": "localhost", "path": "/"},
]
VEH = {"placa": "WOO453", "estadoIntegra": "registro_incompleto",
       "condNombres": "PEDRO", "condPrimerApellido": "PEREZ", "condSegundoApellido": "SOTO",
       "condCedulaCiudadania": "1020304050",
       "lecturasIA": {}, "fotos": []}

with sync_playwright() as p:
    n = p.chromium.launch()
    for ancho, etiqueta in [(1440, "escritorio"), (899, "movil"), (420, "movil-pequeno")]:
        ctx = n.new_context(viewport={"width": ancho, "height": 900})
        ctx.add_cookies(COOKIES)
        pag = ctx.new_page()

        def ruta(route, _request):
            if "obtener-vehiculo" in _request.url:
                route.fulfill(status=200, content_type="application/json",
                              body=json.dumps({"data": VEH}))
            elif "/vehiculos/" in _request.url:
                route.fulfill(status=200, content_type="application/json",
                              body='{"message":"ok","vehiculos":[]}')
            else:
                route.continue_()

        pag.route("**/vehiculos/**", ruta)
        pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=2&placa=WOO453",
                 wait_until="networkidle")
        pag.wait_for_timeout(1500)
        # Scroll profundo para forzar el estado sticky.
        pag.evaluate("window.scrollTo(0, 1200)")
        pag.wait_for_timeout(400)
        info = pag.evaluate("""() => {
            const bar = document.querySelector('.Datos-avance-container');
            if (!bar) return { hayBarra: false };
            const r = bar.getBoundingClientRect();
            const cs = getComputedStyle(bar);
            return { hayBarra: true, top: Math.round(r.top), position: cs.position,
                     z: cs.zIndex };
        }""")
        print(f"{etiqueta} ({ancho}px):", info)
        ctx.close()
    n.close()
print("OK")

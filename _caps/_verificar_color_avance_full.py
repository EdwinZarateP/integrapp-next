"""Llena TODO el formulario del paso 2 (3 rondas por los selects
dependientes) y verifica el tramo de color final (verde ≥90%)."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
COOKIES = [
    {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "CONDUCTOR", "domain": "localhost", "path": "/"},
]
VEH = {"placa": "WOO453", "estadoIntegra": "registro_incompleto",
       "lecturasIA": {}, "fotos": []}

with sync_playwright() as p:
    n = p.chromium.launch()
    ctx = n.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies(COOKIES)
    pag = ctx.new_page()

    def ruta(route, request):
        if "obtener-vehiculo" in request.url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"data": VEH}))
        elif "/vehiculos/" in request.url:
            route.fulfill(status=200, content_type="application/json",
                          body='{"message":"ok","vehiculos":[]}')
        else:
            route.continue_()

    pag.route("**/vehiculos/**", ruta)
    pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=2&placa=WOO453",
             wait_until="networkidle")
    pag.wait_for_timeout(1500)
    for _ronda in range(3):
        pag.evaluate("""() => {
            document.querySelectorAll('.Datos-contenedor input').forEach(i => {
                if (['file','checkbox','radio'].includes(i.type)) return;
                const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
                set.call(i, 'XX');
                i.dispatchEvent(new Event('input', {bubbles:true}));
            });
            document.querySelectorAll('.Datos-contenedor select').forEach(s => {
                const opt = [...s.options].find(o => o.value && o.value !== '');
                if (opt) {
                    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;
                    set.call(s, opt.value);
                    s.dispatchEvent(new Event('change', {bubbles:true}));
                }
            });
        }""")
        pag.wait_for_timeout(800)
    print(pag.evaluate("""() => {
        const t = document.querySelector('.Datos-avance-texto').textContent.trim();
        const f = document.querySelector('.Datos-barra-avance .Datos-progreso');
        return {avance: t, fondo: getComputedStyle(f).backgroundColor};
    }"""))
    n.close()

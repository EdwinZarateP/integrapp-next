"""Verifica los tramos de color de la barra de avance del paso 2:
🔴 <70% · 🟠 70–89% · 🟢 ≥90%. Rellena inputs requeridos progresivamente."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
COOKIES = [
    {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "CONDUCTOR", "domain": "localhost", "path": "/"},
]
# Empezamos SIN campos: avance 0% (rojo). Luego llenamos inputs requeridos
# visibles hasta pasar los tramos.
VEH = {"placa": "WOO453", "estadoIntegra": "registro_incompleto",
       "lecturasIA": {}, "fotos": []}

with sync_playwright() as p:
    n = p.chromium.launch()
    ctx = n.new_context(viewport={"width": 1440, "height": 900})
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

    def estado():
        return pag.evaluate("""() => {
            const texto = document.querySelector('.Datos-avance-texto');
            const fill = document.querySelector('.Datos-barra-avance .Datos-progreso');
            return {
                avance: texto ? texto.textContent.trim() : null,
                fondo: fill ? getComputedStyle(fill).backgroundColor : null,
            };
        }""")

    print("inicio (0%):", estado())
    # Los campos NO usan atributo required (la validación es por lista):
    # llenamos inputs y selects VISIBLES por fracciones y medimos el tramo.
    for frac in [0.5, 0.75, 1.0]:
        pag.evaluate(f"""() => {{
            const visibles = el => el.offsetParent !== null;
            const inputs = [...document.querySelectorAll(
                '.Datos-form-section input, .Datos-Form-datos-generales input')]
              .filter(i => visibles(i) && !['file', 'checkbox', 'radio'].includes(i.type));
            inputs.slice(0, Math.ceil(inputs.length * {frac})).forEach(i => {{
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value').set;
                setter.call(i, 'XX');
                i.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }});
            const selects = [...document.querySelectorAll(
                '.Datos-form-section select, .Datos-Form-datos-generales select')]
              .filter(s => visibles(s) && s.options.length > 1);
            selects.slice(0, Math.ceil(selects.length * {frac})).forEach(s => {{
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLSelectElement.prototype, 'value').set;
                // Primera opción con valor no vacío.
                const opt = [...s.options].find(o => o.value && o.value !== '');
                if (opt) {{
                    setter.call(s, opt.value);
                    s.dispatchEvent(new Event('change', {{ bubbles: true }}));
                }}
            }});
        }}""")
        pag.wait_for_timeout(800)  # re-render
        print(f"tras llenar {int(frac * 100)}%:", estado())
    n.close()
print("OK")

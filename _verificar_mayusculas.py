# Verifica que el paso 2 guarde los campos de TEXTO en MAYÚSCULA y respete
# los de catálogo (EPS/ARL, ciudades, aseguradora…). Mockea el backend y
# captura el body del PUT actualizar-informacion.
import json
import re
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"
VEH = {"_id": "v1", "placa": "WOO453", "estadoIntegra": "registro_incompleto",
       "idUsuario": "u1", "documentos": {}, "lecturasIA": {},
       # Valores cargados en mixed-case para editarlos y guardar.
       "condNombres": "Jaime", "condDireccion": "calle 12 n 3-21",
       "condEps": "Sanitas", "tenedNombre": "Transportes el Valle",
       "vehColor": "blanco perlado", "RemolPlaca": "rmt123"}

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies([
        {"name": "conductorId", "value": "u1", "url": BASE},
        {"name": "conductorCorreo", "value": "JUAN@X.COM", "url": BASE},
        {"name": "conductorPerfil", "value": "CONDUCTOR", "url": BASE},
        {"name": "conductorPrimerNombre", "value": "JAIME", "url": BASE},
    ])
    page = ctx.new_page()
    bodies = []

    def catch(route):
        bodies.append(json.loads(route.request.post_data or "{}"))
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"message": "ok"}))

    ctx.route(re.compile(r"actualizar-informacion"), catch)
    page.route("**/vehiculos/obtener-vehiculo/**",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"data": VEH})))
    page.goto(f"{BASE}/PanelConductores/?vista=flujo&paso=2&placa=WOO453",
              wait_until="networkidle")
    page.wait_for_selector('[data-campo="condNombres"] input', timeout=20000)

    # Editar dos campos de texto en minúscula para disparar el autoguardado.
    page.fill('[data-campo="condNombres"] input', "jaime alonso")
    page.fill('[data-campo="condDireccion"] input', "avenida siempre viva 742")
    page.wait_for_timeout(4000)  # debounce 2,5 s + request

    if not bodies:
        fallos.append("no llegó ningún PUT actualizar-informacion")
    else:
        body = bodies[-1]
        casos = [
            ("condNombres", "JAIME ALONSO"), ("condDireccion", "AVENIDA SIEMPRE VIVA 742"),
            ("tenedNombre", "TRANSPORTES EL VALLE"), ("vehColor", "BLANCO PERLADO"),
            ("RemolPlaca", "RMT123"),
            ("condEps", "Sanitas"),  # catálogo: se respeta tal cual
        ]
        for campo, esperado in casos:
            obtenido = body.get(campo)
            print(f"    {campo}: {obtenido!r} (esperado {esperado!r})")
            if obtenido != esperado:
                fallos.append(f"{campo}={obtenido!r} ≠ {esperado!r}")

    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: textos en mayúscula, catálogos respetados.")

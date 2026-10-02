"""Verificación del Swal «es la misma persona» generalizado:
- WOO453 con cédulas de PROPIETARIO y TENEDOR cargadas (la del conductor NO):
  al tocar «Cédula del conductor» deben ofrecerse DOS botones de copia.
- Con UNA sola cargada (propietario): Swal sí/no clásico en la del tenedor."""
import json
import pathlib
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"
OUT = pathlib.Path(__file__).parent
COOKIES = [
    {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "CONDUCTOR", "domain": "localhost", "path": "/"},
]

VEH = {
    "placa": "WOO453", "estadoIntegra": "registro_incompleto",
    "documentoIdentidadConductor": None,
    "documentoIdentidadPropietario": "Vehiculos/WOO453/2026-10-01/documentoIdentidadPropietario.webp",
    "documentoIdentidadPropietarioReverso": "Vehiculos/WOO453/2026-10-01/documentoIdentidadPropietarioReverso.webp",
    "documentoIdentidadTenedor": "Vehiculos/WOO453/2026-10-01/documentoIdentidadTenedor.webp",
    "documentoIdentidadTenedorReverso": "Vehiculos/WOO453/2026-10-01/documentoIdentidadTenedorReverso.webp",
    "lecturasIA": {}, "fotos": [],
}

def veh_con(tenedor: bool):
    v = dict(VEH)
    if not tenedor:
        v["documentoIdentidadTenedor"] = None
        v.pop("documentoIdentidadTenedorReverso", None)
    return v

with sync_playwright() as p:
    n = p.chromium.launch()

    for caso, tenedor in [("dos_origenes", True), ("un_origen", False)]:
        ctx = n.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies(COOKIES)
        pag = ctx.new_page()
        veh = veh_con(tenedor)

        def ruta(route_handler, _request, _veh=veh):
            if "obtener-vehiculo" in _request.url:
                route_handler.fulfill(status=200, content_type="application/json",
                                      body=json.dumps({"data": _veh}))
            elif "/vehiculos/" in _request.url:
                route_handler.fulfill(status=200, content_type="application/json",
                                      body='{"message":"ok","vehiculos":[]}')
            else:
                route_handler.continue_()

        pag.route("**/vehiculos/**", ruta)
        pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=2&placa=WOO453", wait_until="networkidle")
        pag.wait_for_timeout(1500)
        # Tocar el botón de la cédula del CONDUCTOR en la tarjeta IA.
        boton = pag.locator("button", has_text="Cédula del conductor").first
        boton.click()
        pag.wait_for_timeout(700)
        info = pag.evaluate("""() => {
            const s = document.querySelector('.swal2-popup');
            if (!s) return { haySwal: false };
            return {
                haySwal: true,
                titulo: s.querySelector('h2') && s.querySelector('h2').textContent,
                html: s.querySelector('.swal2-html-container').textContent.slice(0, 70),
                botones: [...s.querySelectorAll('.swal2-actions button')].map(b => b.textContent.trim()),
            };
        }""")
        print(caso, "->", info)
        pag.screenshot(path=str(OUT / f"reutil_{caso}.png"))
        ctx.close()
    n.close()
print("OK")

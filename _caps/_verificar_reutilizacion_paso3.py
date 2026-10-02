"""Verificación de la sugerencia «♻️ Usar la del conductor» en el PASO 3:
- correo del tenedor == correo del conductor + cédula del conductor cargada
  → el ítem de la cédula del tenedor ofrece el botón.
- correos distintos y documentos distintos → NO aparece.
- dígitos iguales (gemelos) → chip «Cubierto por» tiene precedencia."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
COOKIES = [
    {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "TENEDOR", "domain": "localhost", "path": "/"},
]
PLACA = "Vehiculos/WOO453/2026-10-01/x.webp"
BASE_VEH = {
    "placa": "WOO453", "estadoIntegra": "registro_incompleto", "idUsuario": "verif",
    "condCorreo": "MISMO@CORREO.COM", "condCedulaCiudadania": "1020304050",
    "documentoIdentidadConductor": PLACA, "documentoIdentidadConductorReverso": PLACA,
    "lecturasIA": {}, "fotos": [],
}
CASOS = {
    "correo_igual": {**BASE_VEH, "tenedCorreo": "mismo@correo.com", "tenedDocumento": "987654321"},
    "todo_distinto": {**BASE_VEH, "tenedCorreo": "OTRO@CORREO.COM", "tenedDocumento": "987654321"},
    "digitos_iguales": {**BASE_VEH, "tenedCorreo": "OTRO@CORREO.COM", "tenedDocumento": "1.020.304.050"},
}

with sync_playwright() as p:
    n = p.chromium.launch()
    for nombre, veh in CASOS.items():
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
        pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=3&placa=WOO453",
                 wait_until="networkidle")
        pag.wait_for_timeout(1200)
        # Abrir la sección del tenedor (colapsable).
        pag.locator(".seccion-header", has_text="Tenedor").click()
        pag.wait_for_timeout(400)
        info = pag.evaluate("""() => {
            const filas = [...document.querySelectorAll('.doc-item-row')];
            const fila = filas.find(f => f.textContent.includes('Documento de Identidad del Tenedor'));
            if (!fila) return { fila: false };
            const botones = [...fila.querySelectorAll('button')].map(b => b.textContent.trim());
            const chip = fila.textContent.includes('Cubierto por');
            return { fila: true, botones, chipCubierto: chip };
        }""")
        print(nombre, "->", info)
        ctx.close()
    n.close()
print("OK")

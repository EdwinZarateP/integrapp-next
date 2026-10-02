"""Verifica la invitación del conductor DESDE el paso 2 (sesión TENEDOR):
- Sin invitación → caja con botón «✉️ Invitar a {correo}» (usa condCorreo).
- Invitación pendiente → chip + Reenviar/Quitar.
- Vinculado → chip verde + Quitar.
- Y en el paso 1 ya NO existe el botón «➕ Invitar»."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
CASOS = [
    ("sin_invitacion", {"placa": "WOO453", "estadoIntegra": "registro_incompleto"}),
    ("pendiente", {"placa": "WOO453", "estadoIntegra": "registro_incompleto",
                   "invitacionConductor": {"correo": "juanc@x.com", "estado": "pendiente"}}),
    ("vinculado", {"placa": "WOO453", "estadoIntegra": "registro_incompleto",
                   "idConductor": "abc123",
                   "invitacionConductor": {"correo": "juanc@x.com", "estado": "aceptada"}}),
]

with sync_playwright() as p:
    n = p.chromium.launch()
    for nombre, veh in CASOS:
        ctx = n.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies([
            {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
            {"name": "conductorPerfil", "value": "TENEDOR", "domain": "localhost", "path": "/"},
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
        # Escribir el correo del conductor en el formulario (simula el tenedor).
        pag.evaluate("""() => {
            const i = document.querySelector('[name="condCorreo"]');
            if (i) {
                const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                set.call(i, 'nuevoconductor@x.com');
                i.dispatchEvent(new Event('input', {bubbles: true}));
            }
        }""")
        pag.wait_for_timeout(600)
        info = pag.evaluate("""() => {
            const caja = document.querySelector('.Datos-vinculacion');
            return {
                hayCaja: !!caja,
                texto: caja ? caja.querySelector('.Datos-vinculacion-estado').textContent.trim().slice(0, 60) : null,
                botones: caja ? [...caja.querySelectorAll('button')].map(b => ({ t: b.textContent.trim(), disabled: b.disabled })) : [],
            };
        }""")
        print(nombre, "->", info)
        ctx.close()

    # Paso 1: el botón «➕ Invitar» ya no existe.
    ctx = n.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies([
        {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
        {"name": "conductorPerfil", "value": "TENEDOR", "domain": "localhost", "path": "/"},
    ])
    pag = ctx.new_page()
    pag.route("**/vehiculos/**", lambda r: r.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({"message": "ok", "vehiculos": [
            {"placa": "WOO453", "estadoIntegra": "registro_incompleto", "idUsuario": "verif"}]})))
    pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=1", wait_until="networkidle")
    pag.wait_for_timeout(1500)
    sin_conductor = pag.evaluate("""() => {
        const t = document.body.innerText;
        return { botonInvitar: t.includes('➕ Invitar'),
                 textoSinConductor: t.includes('invítalo en Datos básicos') };
    }""")
    print("paso1 ->", sin_conductor)
    n.close()
print("OK")

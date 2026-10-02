"""Verificación visual de la sidebar-columna del panel de conductores
(escritorio) vs fila sticky (móvil). Requiere dev server en :3000."""
import pathlib
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"
OUT = pathlib.Path(__file__).parent
COOKIES = [
    {"name": "conductorId", "value": "verificacion-sidebar", "domain": "localhost", "path": "/"},
    {"name": "conductorCorreo", "value": "prueba@correo.com", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "CONDUCTOR", "domain": "localhost", "path": "/"},
]

with sync_playwright() as p:
    navegador = p.chromium.launch()
    for ancho, etiqueta in [(1440, "escritorio"), (900 - 1, "movil"), (420, "movil-pequeno")]:
        ctx = navegador.new_context(viewport={"width": ancho, "height": 900})
        ctx.add_cookies(COOKIES)
        pag = ctx.new_page()
        pag.route("**/vehiculos/**", lambda ruta: ruta.fulfill(
            status=200, content_type="application/json",
            body='{"message": "ok", "vehiculos": []}'))
        pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=1", wait_until="networkidle")
        pag.wait_for_timeout(800)
        pag.screenshot(path=str(OUT / f"sidebar_{etiqueta}.png"), full_page=False)
        # Dónde quedó la navegación: columna o fila.
        modo = pag.evaluate("""() => {
            const sb = document.querySelector('.sidebar-conductor');
            if (!sb) return 'sin sidebar';
            return getComputedStyle(sb).flexDirection;
        }""")
        activo = pag.evaluate("""() => {
            const b = document.querySelector('.btn-sidebar-step.active span');
            return b ? b.textContent : null;
        }""")
        print(f"{etiqueta} ({ancho}px): flexDirection={modo}, activo={activo!r}")
        ctx.close()
    navegador.close()
print("OK")

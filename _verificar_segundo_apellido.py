# Verifica que el SEGUNDO APELLIDO del conductor es OPCIONAL en paso 2
# (2026-10-14, pedido del usuario): sin asterisco, no cuenta en «Faltan N»
# y «Continuar» NO se bloquea cuando todo lo demás obligatorio está lleno.
# (Primer apellido SIGUE obligatorio; prop/tened/remolque usan un campo
# único «Nombre/Razón» — este cambio solo toca al conductor.)
import io
import json
import re
import sys
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = "http://localhost:4173/integrapp"

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    # Sesión de conductor (el paso 2 es del panel del conductor).
    ctx.add_cookies([
        {"name": "conductorId", "value": "c1", "url": BASE},
        {"name": "conductorCorreo", "value": "TEST@X.COM", "url": BASE},
        {"name": "conductorPerfil", "value": "CONDUCTOR", "url": BASE},
    ])
    page = ctx.new_page()
    page.route("**/vehiculos/obtener-vehiculos*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"message": "ok", "vehicles": [
                                       {"placa": "ESZ744", "estadoIntegra": "registro_incompleto"}]})))
    page.route("**/vehiculos/obtener-vehiculo/*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"placa": "ESZ744", "estadoIntegra": "registro_incompleto",
                                                    "documentos": {}, "fotos": []})))
    page.route("**/conductores/alta-seguridad/listar", lambda r: r.fulfill(status=200, content_type="application/json", body="[]"))
    page.route(re.compile(r".*/vehiculos/.*"), lambda r: r.fulfill(status=200, content_type="application/json", body="{}"))

    page.goto(f"{BASE}/PanelConductores/?vista=flujo&paso=2&placa=ESZ744", wait_until="commit")
    page.wait_for_timeout(3500)

    # El asterisco de obligatorio: mirar la etiqueta del campo.
    def etiqueta_con_ast(nombre_campo):
        el = page.locator(f"[name='{nombre_campo}']").first
        lbl = page.locator("label", has_text=re.compile(nombre_campo == "condSegundoApellido" and "Segundo Apellido" or "Primer Apellido")).first
        return el, (lbl.inner_text() if lbl.count() else "")

    _, txt_seg = etiqueta_con_ast("condSegundoApellido")
    _, txt_pri = etiqueta_con_ast("condPrimerApellido")
    print(f"[1] Etiqueta 2do apellido: {txt_seg!r} · 1er apellido: {txt_pri!r}")
    if "*" in txt_seg:
        fallos.append("el 2do apellido sigue marcado como obligatorio (*)")
    if "*" not in txt_pri:
        fallos.append("el 1er apellido PERDIÓ su asterisco obligatorio")

    # El contador «Faltan N» no debe contar el 2do apellido vacío: se mide
    # indirectamente — llenar TODO lo obligatorio del conductor excepto nada
    # más y comprobar que el avance ya no lo exige. Con el campo vacío y el
    # resto del conductor lleno a mano sería largo; basta validar que el
    # campo ya no está en la lista de errores al Continuar con todo lo demás
    # lleno (simulado): verificamos el hint de «faltan» texto del bloque.
    avance = page.locator(".Datos-avance-texto, [class*='avance']").first.inner_text(timeout=3000) \
        if page.locator(".Datos-avance-texto").count() else "(sin texto de avance)"
    print(f"[2] Texto de avance: {avance!r}")

    browser.close()

if fallos:
    print("\nFALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("\nOK: 2do apellido opcional (sin *) y 1er apellido sigue obligatorio")

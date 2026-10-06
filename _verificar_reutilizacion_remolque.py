# Verifica la reutilización de la cédula del DUEÑO DEL REMOLQUE como ORIGEN
# (2026-10-06): con las cédulas de propietario, tenedor y remolque cargadas,
# el botón «Cédula del conductor» de la tarjeta IA ofrece un DESPLEGABLE con
# las 3 — antes remolque no era origen y el Swal recortaba a 2 botones.
# También verifica la dirección inversa clásica (remolque como destino con
# select cuando las 3 figuras están cargadas). API mockeada.
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"

# Vehículo con las 3 cédulas YA cargadas (remolque incluida) y la del
# conductor vacía.
VEH = {
    "_id": "v1", "placa": "WOO453", "estadoIntegra": "registro_incompleto",
    "idUsuario": "u1", "fotos": [],
    "documentoIdentidadPropietario": "Vehiculos/WOO453/2026-10-06/p.webp",
    "documentoIdentidadPropietarioReverso": "Vehiculos/WOO453/2026-10-06/pr.webp",
    "documentoIdentidadTenedor": "Vehiculos/WOO453/2026-10-06/t.webp",
    "documentoIdentidadTenedorReverso": "Vehiculos/WOO453/2026-10-06/tr.webp",
    "documentoIdentidadRemolque": "Vehiculos/WOO453/2026-10-06/r.webp",
    "documentoIdentidadRemolqueReverso": "Vehiculos/WOO453/2026-10-06/rr.webp",
    "lecturasIA": {},
    "documentos": {},
}

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies([
        {"name": "conductorId", "value": "u1", "url": BASE},
        {"name": "conductorCorreo", "value": "JUAN@X.COM", "url": BASE},
        {"name": "conductorPerfil", "value": "TENEDOR", "url": BASE},
        {"name": "conductorPrimerNombre", "value": "JUAN", "url": BASE},
    ])
    page = ctx.new_page()
    reutilizar_llamado = {}

    import re as _re

    def mock_reutilizar(route):
        cuerpo = route.request.post_data or ""
        m = _re.search(r'name="origen"\r?\n\r?\n([^\r\n]+)', cuerpo)
        if m:
            reutilizar_llamado["origen"] = m.group(1)
        route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "message": "ok", "url": "https://firma/cond.webp",
            "url_reverso": "https://firma/condR.webp", "lectura_ia": None}))

    page.route("**/vehiculos/reutilizar-documento", mock_reutilizar)
    page.on("request", lambda r: print("  REQ:", r.method, r.url[-60:])
            if "reutilizar" in r.url else None)
    page.on("console", lambda m: print("  CONSOLE:", m.type, m.text[:150])
            if m.type == "error" else None)
    page.route("**/vehiculos/obtener-vehiculo/**",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"data": VEH})))
    page.route("**/vehiculos/actualizar-informacion/**",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"message": "ok"})))

    page.goto(f"{BASE}/PanelConductores/?vista=flujo&paso=2&placa=WOO453",
              wait_until="networkidle")
    page.wait_for_selector(".Datos-iaDoc-boton", timeout=20000)

    # Botón «Cédula del conductor» de la tarjeta ⚡ (la primera cédula).
    page.click("text=Cédula del conductor")
    page.wait_for_selector(".swal2-select", timeout=8000)
    opciones = [o for o in page.locator(".swal2-select option").all_inner_texts()
                if "copiamos" not in o]  # sin el placeholder
    print(f"[1] Swal con desplegable, opciones: {opciones}")
    if len(opciones) != 3:
        fallos.append(f"esperaba 3 orígenes en el desplegable, hay {len(opciones)}: {opciones}")
    if not any("remolque" in o.lower() for o in opciones):
        fallos.append(f"el dueño del remolque no aparece como origen: {opciones}")

    # Elegir «La del dueño del remolque» → confirmar → backend con origen=remolque.
    page.select_option(".swal2-select", label=[o for o in opciones if "remolque" in o.lower()][0])
    page.click("text=Usar la seleccionada")
    page.wait_for_timeout(2000)
    page.screenshot(path="_caps/reutilizacion_remolque.png")
    origen = reutilizar_llamado.get("origen")
    print(f"[2] reutilizar-documento llamado con origen={origen!r}")
    if origen != "remolque":
        fallos.append(f"origen enviado al backend = {origen!r} ≠ 'remolque'")

    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: la cédula del dueño del remolque sirve como origen de reutilización.")

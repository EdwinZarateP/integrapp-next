# Verifica las reglas nuevas de «Datos del Remolque (Opcional)» (2026-10-06):
# 1. Con el checkbox activo, los campos del remolque llevan * y al dar
#    «Continuar» quedan en ROJO y bloquean (Swal de faltantes los lista).
# 2. Largo/Alto/Ancho: no acepta valores > 50 (se rechaza al digitar).
# API mockeada.
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"
VEH = {
    "_id": "v1", "placa": "WOO453", "estadoIntegra": "registro_incompleto",
    "idUsuario": "u1", "fotos": [], "documentos": {}, "lecturasIA": {},
    # Un dato de remolque guardado → el checkbox llega marcado.
    "RemolPlaca": "RMT123",
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
    page.route("**/vehiculos/obtener-vehiculo/**",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"data": VEH})))
    page.route("**/vehiculos/actualizar-informacion/**",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"message": "ok"})))

    page.goto(f"{BASE}/PanelConductores/?vista=flujo&paso=2&placa=WOO453",
              wait_until="networkidle")

    # Expandir la sección del remolque (llega colapsada plegada? — con datos
    # guardados el checkbox viene marcado; la sección se despliega sola).
    page.wait_for_selector("text=Datos del Remolque", timeout=20000)
    page.wait_for_selector('[data-campo="RemolPlaca"]', timeout=10000)

    # 1. El «Largo (m)» muestra el asterisco de obligatorio.
    label_largo = page.locator('[data-campo="RemolLargo"]').locator("xpath=..").inner_text()
    print(f"[1] Etiqueta Largo: {label_largo!r}")
    if "*" not in label_largo:
        fallos.append(f"Largo sin asterisco de obligatorio: {label_largo!r}")

    # 2. Digitar 75 en Largo → el guard lo rechaza (no pasa de 5→7 porque 75>50;
    #    digitamos 7 (pasa) y luego 5 (75 > 50 → rechazado, queda en 7).
    largo_input = page.locator('[data-campo="RemolLargo"] input')
    largo_input.fill("")
    largo_input.type("7")
    largo_input.type("5")
    valor = largo_input.input_value()
    print(f"[2] Largo tras digitar 7 y 5: {valor!r}")
    if valor == "75":
        fallos.append("Largo aceptó 75 (debe rechazar >50)")
    largo_input.fill("")  # devolverlo a vacío para el siguiente paso

    # 3. «Continuar» con faltantes (todo lo demás vacío también): el Swal
    #    lista campos y RemolModelo/RemolClase/… quedan en rojo.
    page.click("text=Continuar")
    page.wait_for_selector(".swal2-popup", timeout=8000)
    swal_texto = page.locator(".swal2-popup").inner_text()
    page.screenshot(path="_caps/remolque_obligatorio.png")
    print(f"[3] Swal: {swal_texto[:180].replace(chr(10), ' | ')}")
    if "obligatorios" not in swal_texto.lower():
        fallos.append("el Swal de faltantes no apareció")
    page.click(".swal2-confirm")
    page.wait_for_timeout(400)
    rojo_modelo = page.evaluate(
        "document.querySelector('[data-campo=\"RemolModelo\"] input, [data-campo=\"RemolModelo\"] select, [data-campo=\"RemolModelo\"]')?.className || ''")
    print(f"[4] Clases de RemolModelo tras Continuar: {rojo_modelo!r}")
    if "error" not in rojo_modelo.lower():
        fallos.append(f"RemolModelo no quedó marcado en rojo: {rojo_modelo!r}")

    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: remolque obligatorio con checkbox + tope 50 en dimensiones.")

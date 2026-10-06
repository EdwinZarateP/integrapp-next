# Verifica /VerificarCorreo (estado pendiente_aceptacion):
# 1440px → tarjeta ancha (~1040px) con UNA declaración por fila a todo el
# ancho (no 2 columnas — pedido del usuario); 390px → igual (1 fila, móvil
# intacto). Header idéntico al de RegistroConductor: wordmark «IntegrApp»
# sin uppercase y «App» en verde #27ae60. API mockeada por route interception.
import json
import sys
from playwright.sync_api import sync_playwright

DECLS = [
    {"id": f"d{i}", "titulo": f"Declaración {i+1} — Título de prueba",
     "texto_html": "<p>Texto de la declaración con suficiente contenido para "
                   "ocupar unas líneas dentro de la caja.</p>" * 3}
    for i in range(7)
]
RESPUESTA = {
    "estado": "pendiente_aceptacion",
    "correo": "prueba@x.com",
    "politica": {"version": 2, "titulo": "Declaraciones de Vinculación",
                 "texto_html": "<p>política</p>", "declaraciones": DECLS},
}

BASE = "http://localhost:3000/integrapp/VerificarCorreo?token=abc"
CAPS = "_caps"

fallos = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    for ancho, etiqueta in [(1440, "desktop"), (390, "movil")]:
        page = browser.new_page(viewport={"width": ancho, "height": 900})
        page.route("**/conductores/verificar-correo*",
                   lambda r: r.fulfill(status=200,
                                       content_type="application/json",
                                       body=json.dumps(RESPUESTA)))
        page.goto(BASE, wait_until="networkidle")
        card = page.locator(".VC-card")
        card.wait_for(state="visible", timeout=10000)
        page.wait_for_selector(".VC-declaraciones", timeout=10000)
        cajas = page.locator(".VC-politicaCaja")
        n = cajas.count()
        rects = [cajas.nth(i).bounding_box() for i in range(n)]

        card_w = card.bounding_box()["width"]
        # Todas las cajas en FILAS distintas (misma columna)…
        en_fila = [cajas.nth(i).bounding_box()["x"] for i in range(n)]
        una_por_fila = all(abs(x - en_fila[0]) < 5 for x in en_fila)
        # …y ocupando TODO el ancho de la tarjeta (mismo x y ancho que la card interior).
        caja0 = rects[0]
        padding = 48 if ancho > 600 else 20
        ocupa = abs(caja0["x"] - (card.bounding_box()["x"] + padding)) < 4 and \
            abs((caja0["x"] + caja0["width"]) - (card.bounding_box()["x"] + card_w - padding)) < 4

        print(f"[{etiqueta} {ancho}px] card={card_w:.0f}px · cajas={n} · "
              f"una_por_fila={una_por_fila} · a_todo_ancho={ocupa}")
        page.screenshot(path=f"{CAPS}/verificar_correo_{etiqueta}.png", full_page=True)

        if ancho == 1440:
            if not (900 <= card_w <= 1100):
                fallos.append(f"desktop: card {card_w:.0f}px (esperado ~1040)")
            if not una_por_fila:
                fallos.append("desktop: hay cajas en 2 columnas (esperado 1 por fila)")
            if not ocupa:
                fallos.append("desktop: las cajas no ocupan todo el ancho de la tarjeta")
        else:
            if not una_por_fila:
                fallos.append("movil: cajas en columnas raras")
            if card_w > 390:
                fallos.append(f"movil: card {card_w:.0f}px se desborda del viewport")

        # Header igual al de RegistroConductor (solo desktop, una vez bastaría).
        if ancho == 1440:
            nombre = page.locator(".VC-brandName")
            texto = nombre.inner_text()
            transform = nombre.evaluate("el => getComputedStyle(el).textTransform")
            color_acento = page.locator(".VC-brandAccent").evaluate(
                "el => getComputedStyle(el).color")
            print(f"[header] wordmark={texto!r} · text-transform={transform} · acento={color_acento}")
            if texto != "IntegrApp":
                fallos.append(f"header: wordmark {texto!r} ≠ 'IntegrApp'")
            if transform != "none":
                fallos.append(f"header: text-transform {transform} ≠ none")
            if color_acento != "rgb(39, 174, 96)":
                fallos.append(f"header: acento {color_acento} ≠ verde #27ae60")
        page.close()

    # Estado simple (error) sigue compacto.
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.route("**/conductores/verificar-correo*",
               lambda r: r.fulfill(status=400, content_type="application/json",
                                   body=json.dumps({"detail": "token expirado"})))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_selector(".VC-iconoError", timeout=10000)
    ancho_card = page.locator(".VC-card").bounding_box()["width"]
    print(f"[error 1440px] card={ancho_card:.0f}px (compacta)")
    if ancho_card > 500:
        fallos.append(f"error: card {ancho_card:.0f}px debería seguir en 440px")
    page.close()
    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: 1 declaración por fila a todo el ancho, header idéntico a RegistroConductor.")

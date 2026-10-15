# Verifica el módulo «Indicadores» de /revision (2026-10-14):
# 1. Ruta directa /revision/indicadores renderiza el BarChart apilado.
# 2. Leyenda con TODOS los estados y chips de totales de la ventana.
# 3. Selector 7/30/90 dispara el request con ?dias=N correcto.
# 4. Sidebar: botón «Indicadores» navega y reescribe la URL.
# 5. Tooltip del gráfico muestra fecha + desglose por estado + total.
# API mockeada por route interception (no necesita backend).
import json
import os
import re
import sys
from datetime import date, timedelta

from playwright.sync_api import sync_playwright

BASE = os.environ.get("VERIFICAR_BASE", "http://localhost:3000/integrapp")

ESTADOS = [
    {"estado": "aprobado", "etiqueta": "Aprobado", "color": "#15803d"},
    {"estado": "en_revision", "etiqueta": "En revisión (histórico)", "color": "#f59e0b"},
    {"estado": "completado_revision", "etiqueta": "En revisión", "color": "#9a3412"},
    {"estado": "devuelto", "etiqueta": "Devuelto", "color": "#f87171"},
    {"estado": "registro_incompleto", "etiqueta": "Pendiente conductor", "color": "#b91c1c"},
    {"estado": "en_actualizacion", "etiqueta": "En actualización", "color": "#fb923c"},
    {"estado": "inactivo", "etiqueta": "Inactivo", "color": "#94a3b8"},
    {"estado": "rechazado", "etiqueta": "Rechazado", "color": "#475569"},
]


def respuesta(dias: int) -> dict:
    """Serie fake: un día con mezcla de estados, días vacíos de por medio."""
    hoy = date.today()
    series = []
    for i in range(dias - 1, -1, -1):
        d = hoy - timedelta(days=i)
        if i == dias - 1:  # el día más viejo de la ventana: mezcla completa
            conteos = {"aprobado": 5, "completado_revision": 4,
                       "registro_incompleto": 2, "devuelto": 1}
        elif i == dias - 3:  # solo pendientes
            conteos = {"registro_incompleto": 3}
        else:
            conteos = {}
        series.append({"fecha": d.isoformat(), "total": sum(conteos.values()),
                       "conteos": conteos})
    return {"dias": dias, "desde": series[0]["fecha"], "estados": ESTADOS,
            "series": series}


fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies([
        {"name": "seguridadId", "value": "s1", "url": BASE},
        {"name": "seguridadNombre", "value": "EDWIN", "url": BASE},
        {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": BASE},
    ])
    page = ctx.new_page()
    llamadas = []

    def mock_indicadores(route):
        llamadas.append(route.request.url)
        dias = 7 if "dias=7" in route.request.url else 90 if "dias=90" in route.request.url else 30
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps(respuesta(dias)))

    page.route("**/vehiculos/registros-por-dia*", mock_indicadores)
    page.route("**/vehiculos/obtener-vehiculos-incompletos*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"message": "ok", "vehicles": []})))
    page.route("**/vehiculos/obtener-aprobados-paginados*",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"vehiculos": [], "total": 0})))

    # ── 1: entrada directa a la ruta estática del módulo.
    page.goto(f"{BASE}/revision/indicadores", wait_until="commit")
    page.wait_for_selector(".recharts-wrapper", timeout=15000)
    if not page.url.rstrip("/").endswith("/revision/indicadores"):
        fallos.append(f"URL no quedó en /revision/indicadores: {page.url}")
    else:
        print(f"[1] Ruta directa renderiza el gráfico ({page.url})")

    # ── 2: leyenda completa + chips de totales (30 días default).
    page.wait_for_selector(".recharts-legend-wrapper", timeout=8000)
    leyenda = page.locator(".recharts-legend-wrapper").inner_text()
    faltan = [e["etiqueta"] for e in ESTADOS if e["etiqueta"] not in leyenda]
    if faltan:
        fallos.append(f"la leyenda no muestra: {faltan}")
    else:
        print("[2] Leyenda con los 8 estados")
    chips = page.locator("text=registradas en 30 días")
    if chips.count() == 0:
        fallos.append("no aparecen los chips de totales de la ventana de 30 días")
    else:
        print("[3] Chips de totales de la ventana (30 días)")
    if not any("dias=30" in u or "dias=" not in u for u in llamadas):
        fallos.append(f"el request inicial no usó 30 días: {llamadas}")
    # 30 barras (una por día, zero-fill incluido).
    barras = page.locator(".recharts-bar-rectangle").count()
    if barras == 0:
        fallos.append("el gráfico no pintó barras")
    else:
        print(f"[4] Barras pintadas ({barras} rectángulos de segmento)")

    # ── 3: selector 7/30/90.
    page.click("button:has-text('Últimos 7 días')")
    page.wait_for_timeout(900)
    if not any("dias=7" in u for u in llamadas):
        fallos.append(f"el chip de 7 días no disparó ?dias=7: {llamadas}")
    else:
        print("[5] Chip «Últimos 7 días» dispara ?dias=7")
    if page.locator("text=registradas en 7 días").count() == 0:
        fallos.append("los chips de totales no se actualizaron a 7 días")

    # ── 4: tooltip con desglose por estado y total. Se hace hover sobre el
    # CENTRO de un segmento real (los días vacíos tienen rectángulos de altura
    # 0 que no disparan el tooltip de Recharts).
    centro = page.evaluate("""() => {
      const rects = [...document.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect')];
      const bueno = rects.find(r => r.getBoundingClientRect().height > 6);
      if (!bueno) return null;
      const b = bueno.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }""")
    if not centro:
        fallos.append("no se encontró un segmento de barra con altura para el hover")
    else:
        page.mouse.move(centro["x"], centro["y"])
        page.wait_for_selector("text=Total registradas", timeout=5000)
    tooltip = page.locator(".recharts-tooltip-wrapper").inner_text(timeout=5000)
    if "Pendiente conductor" not in tooltip:
        fallos.append(f"el tooltip no desglosa por estado: {tooltip[:120]!r}")
    else:
        print("[6] Tooltip con desglose por estado + total")

    # ── 5: navegación desde la sidebar (bandejas → Indicadores → Volver).
    page.click("button:has-text('← Volver')")
    page.wait_for_url(re.compile(r"/revision/\?"), timeout=5000)
    page.click(".revx-nav-item:has-text('Indicadores')")
    page.wait_for_selector(".recharts-wrapper", timeout=8000)
    if not page.url.rstrip("/").endswith("/revision/indicadores"):
        fallos.append(f"el botón de la sidebar no reescribió la URL: {page.url}")
    else:
        print(f"[7] Sidebar «Indicadores» navega y reescribe la URL ({page.url})")

    os.makedirs("_caps", exist_ok=True)
    page.screenshot(path="_caps/indicadores_revision.png", full_page=True)
    print("[8] Captura: _caps/indicadores_revision.png")
    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: indicadores de /revision (ruta, leyenda, selector, tooltip, sidebar).")

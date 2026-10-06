# -*- coding: utf-8 -*-
"""Verifica el header unificado en home, LoginConductores y LoginUsuario:
logo a la IZQUIERDA, wordmark «IntegrApp» TAL CUAL (sin uppercase forzado por
CSS) y «App» en verde #27ae60. Escritorio y móvil."""
from playwright.sync_api import sync_playwright

PAGINAS = [
    ("home", "http://localhost:3000/integrapp/"),
    ("conductores", "http://localhost:3000/integrapp/LoginConductores/"),
    ("usuarios", "http://localhost:3000/integrapp/LoginUsuario/"),
]

with sync_playwright() as p:
    n = p.chromium.launch()
    for nombre, url in PAGINAS:
        for ancho in (1366, 390):
            pg = n.new_page(viewport={"width": ancho, "height": 900})
            pg.goto(url, wait_until="domcontentloaded")
            # Espera explícita: en dev la primera visita a una ruta recompila
            # y el evaluate puede correr antes de que pinte el header.
            pg.wait_for_selector("header span", timeout=30000)
            r = pg.evaluate("""() => {
                const spans = [...document.querySelectorAll('header span')];
                const app = spans.find(s => s.textContent.trim() === 'App');
                if (!app) return null;
                const cs = getComputedStyle(app);
                const marca = app.parentElement;
                const csMarca = getComputedStyle(marca);
                const caja = marca.getBoundingClientRect();
                return {color: cs.color, x: caja.x,
                        uppercase: csMarca.textTransform,
                        textoMarca: marca.textContent.trim()};
            }""")
            assert r, f"{nombre}: no se encontró el wordmark con «App»"
            assert r["color"] == "rgb(39, 174, 96)", f"{nombre}: «App» no es verde: {r['color']}"
            assert r["uppercase"] == "none", f"{nombre}: el CSS fuerza uppercase ({r['uppercase']})"
            assert r["textoMarca"] == "IntegrApp", f"{nombre}: el wordmark dice «{r['textoMarca']}»"
            assert r["x"] < ancho * 0.45, f"{nombre}: el wordmark no está a la izquierda (x={r['x']})"
            print(f"[{nombre} {ancho}px] OK · «{r['textoMarca']}» · App={r['color']} · x={r['x']:.0f}px")
            pg.close()
    n.close()
print("VERIFICACION MARCAS OK")

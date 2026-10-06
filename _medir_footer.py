# -*- coding: utf-8 -*-
"""Altura del footer compacto vs viewport, escritorio y móvil."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    n = p.chromium.launch()
    for ancho, alto in ((1366, 768), (390, 844)):
        pg = n.new_page(viewport={"width": ancho, "height": alto})
        pg.goto("http://localhost:3000/integrapp/", wait_until="networkidle")
        h = pg.evaluate("""() => {
            const f = document.querySelector('footer');
            return {alto: f.getBoundingClientRect().height,
                    viewport: window.innerHeight,
                    pct: f.getBoundingClientRect().height / window.innerHeight * 100};
        }""")
        print(f"{ancho}px: footer={h['alto']:.0f}px de {h['viewport']}px ({h['pct']:.0f}% de la pantalla)")
        pg.close()
    n.close()

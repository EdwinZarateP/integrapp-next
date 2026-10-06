# -*- coding: utf-8 -*-
"""Mediciones del home rediseñado: header con wordmark, tamaño de tarjetas y
píldora «Ingresar» en varios viewports."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    n = p.chromium.launch()
    for ancho in (1920, 1366, 768, 390):
        pg = n.new_page(viewport={"width": ancho, "height": 900})
        pg.goto("http://localhost:3000/integrapp/", wait_until="networkidle")
        marca = pg.get_by_text("IntegrApp", exact=True).first
        card = pg.locator("button").first
        box = card.bounding_box()
        pill = card.get_by_text("Ingresar").count()
        print(f"{ancho}px: marca_en_header={marca.is_visible()} "
              f"card_w={box['width']:.0f} card_h={box['height']:.0f} pill={pill}")
        pg.close()
    n.close()

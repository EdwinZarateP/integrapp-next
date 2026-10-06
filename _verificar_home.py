# -*- coding: utf-8 -*-
"""Verificación visual del home minimalista (2026-10-06): 3 portales, sin
buscador de guía, título IntegrApp, sin «Selecciona tu portal». Capturas en
_caps/ (escritorio 1280px y móvil 390px)."""
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp/"
CAPS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_caps")
os.makedirs(CAPS, exist_ok=True)

with sync_playwright() as p:
    navegador = p.chromium.launch()
    for ancho, alto, etiqueta in ((1280, 800, "escritorio"), (390, 844, "movil")):
        pagina = navegador.new_page(viewport={"width": ancho, "height": alto})
        pagina.goto(BASE, wait_until="networkidle")
        cuerpo = pagina.inner_text("body")
        assert "IntegrApp" in cuerpo, "falta el título IntegrApp"
        for texto in ("En Ruta", "Portal Empleados", "Torre de Control"):
            assert texto in cuerpo, f"falta el portal {texto}"
        for texto in ("Portal Transportadores", "Selecciona tu portal",
                      "Accede a la plataforma según tu perfil", "Rastrea tu guía"):
            assert texto not in cuerpo, f"debería haberse quitado: {texto}"
        botones = pagina.locator("button").count()
        pagina.screenshot(path=os.path.join(CAPS, f"home_{etiqueta}.png"), full_page=True)
        print(f"[{etiqueta}] OK · botones visibles: {botones}")
        pagina.close()
    navegador.close()
print("VERIFICACION HOME OK")

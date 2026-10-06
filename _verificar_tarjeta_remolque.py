# Verifica que la Tarjeta de Remolque sea OBLIGATORIA cuando el vehículo
# tiene remolque declarado (2026-10-06): el ítem pierde el chip «opcional»,
# muestra hint «Obligatoria: tu vehículo tiene remolque» y cuenta en el
# avance (no al 100% sin ella). Sin remolque sigue «opcional».
# API mockeada (incluida la URL de producción hardcodeada de ObtenerInfoPlaca).
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"

DOCS_LLENOS = {
    "documentoIdentidadConductor": "u1", "documentoIdentidadConductorReverso": "u1r",
    "documentoIdentidadPropietario": "u2", "documentoIdentidadPropietarioReverso": "u2r",
    "documentoIdentidadTenedor": "u3", "documentoIdentidadTenedorReverso": "u3r",
    "licencia": "u4", "licenciaReverso": "u4r",
    "tarjetaPropiedad": "u5", "tarjetaPropiedadReverso": "u5r",
    "soat": "u6", "revisionTecnomecanica": "u7",
    "condCertificacionBancaria": "u8", "tenedCertificacionBancaria": "u9",
    "documentoAcreditacionTenedor": "u10", "rutTenedor": "u11",
    "hojaVidaFisica": "u12", "planillaEpsArl": "u13",
    "fotos": ["u14"], "condFoto": "u15",
}


def veh(**extra):
    v = {"_id": "v1", "placa": "WOO453", "estadoIntegra": "registro_incompleto",
         "idUsuario": "u1", "documentos": {}, "lecturasIA": {}, **DOCS_LLENOS}
    v.update(extra)
    return v


fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for caso, extra, etiqueta in [
        ("con_remolque", {"RemolPlaca": "RMT123", "RemolAlto": "4"}, "con remolque"),
        ("sin_remolque", {}, "sin remolque"),
    ]:
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies([
            {"name": "conductorId", "value": "u1", "url": BASE},
            {"name": "conductorCorreo", "value": "JUAN@X.COM", "url": BASE},
            {"name": "conductorPerfil", "value": "CONDUCTOR", "url": BASE},
            {"name": "conductorPrimerNombre", "value": "JUAN", "url": BASE},
        ])
        page = ctx.new_page()
        VEH = veh(**extra)
        for patron in ("**/vehiculos/obtener-vehiculo/**",
                       "https://integrappi-dvmh.onrender.com/vehiculos/obtener-vehiculo/**"):
            page.route(patron, lambda r: r.fulfill(status=200, content_type="application/json",
                                                   body=json.dumps({"data": VEH})))
        page.route("**/vehiculos/obtener-vehiculos*",
                   lambda r: r.fulfill(status=200, content_type="application/json",
                                       body=json.dumps({"message": "ok", "data": [VEH]})))
        page.goto(f"{BASE}/PanelConductores/?vista=flujo&paso=3&placa=WOO453",
                  wait_until="networkidle")
        page.wait_for_timeout(1500)
        page.click("text=1. Documentos del Vehículo")
        page.wait_for_timeout(500)

        fila = page.locator("text=Tarjeta de Remolque").first
        contexto = fila.locator("xpath=ancestor::div[.//span[contains(@class,'doc-tag-opcional')]][1]"
                                "[.//text()[contains(., 'Tarjeta de Remolque')]]")
        chip = page.locator(".doc-tag-opcional",
                            has=page.locator("text=Tarjeta de Remolque"))
        # Más robusto: buscar el texto del hint en la fila.
        cuerpo = page.inner_text("body")
        avance = page.locator("text=Avance Total").locator("xpath=..").inner_text()
        print(f"[{etiqueta}] avance: {avance.strip()[:60]!r} · "
              f"hint obligatoria: {'Obligatoria: tu vehículo tiene remolque' in cuerpo}")
        page.screenshot(path=f"_caps/tarjeta_remolque_{caso}.png")

        if caso == "con_remolque":
            if "Obligatoria: tu vehículo tiene remolque" not in cuerpo:
                fallos.append("con remolque: el hint de obligatoria no aparece")
            if "100%" in avance:
                fallos.append("con remolque: avance al 100% sin la tarjeta")
        else:
            if "Obligatoria: tu vehículo tiene remolque" in cuerpo:
                fallos.append("sin remolque: la tarjeta no debería ser obligatoria")
            if "100%" not in avance:
                fallos.append(f"sin remolque: el avance debería estar al 100% ({avance!r})")
        ctx.close()
    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: Tarjeta de Remolque obligatoria solo con remolque declarado.")

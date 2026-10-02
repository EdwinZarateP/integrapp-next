"""Verificación visual del rediseño sobrio de las tarjetas de placa (paso 1):
placa en caja tipo placa, chip con punto de color, botones discretos."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
COOKIES = [
    {"name": "conductorId", "value": "verif", "domain": "localhost", "path": "/"},
    {"name": "conductorPerfil", "value": "TENEDOR", "domain": "localhost", "path": "/"},
]

PLACA = "Vehiculos/WOO453/2026-10-01/x.webp"
DOCS_BASE = {
    "tarjetaPropiedad": PLACA, "tarjetaPropiedadReverso": PLACA,
    "soat": PLACA, "revisionTecnomecanica": PLACA,
    "documentoIdentidadConductor": PLACA, "documentoIdentidadConductorReverso": PLACA,
    "documentoIdentidadPropietario": PLACA, "documentoIdentidadPropietarioReverso": PLACA,
    "documentoIdentidadTenedor": PLACA, "documentoIdentidadTenedorReverso": PLACA,
    "licencia": PLACA, "licenciaReverso": PLACA, "planillaEpsArl": PLACA,
    "condFoto": PLACA, "condCertificacionBancaria": PLACA,
    "tenedCertificacionBancaria": PLACA, "documentoAcreditacionTenedor": PLACA,
    "rutTenedor": PLACA, "hojaVidaFisica": PLACA, "fotos": [PLACA],
}
VEHICULOS = [
    {"placa": "WOO453", "estadoIntegra": "registro_incompleto", "idUsuario": "verif",
     **{k: v for k, v in DOCS_BASE.items() if k not in ("documentoIdentidadPropietario", "documentoIdentidadPropietarioReverso", "hojaVidaFisica", "licencia", "licenciaReverso")}},
    {"placa": "ABC789", "estadoIntegra": "aprobado", "idUsuario": "verif", **DOCS_BASE},
    {"placa": "XYZ321", "estadoIntegra": "completado_revision", "idUsuario": "verif"},
]

with sync_playwright() as p:
    n = p.chromium.launch()
    ctx = n.new_context(viewport={"width": 1440, "height": 1000})
    ctx.add_cookies(COOKIES)
    pag = ctx.new_page()

    def ruta(route, request):
        url = request.url
        if "obtener-vehiculos" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"message": "ok", "vehiculos": VEHICULOS}))
        elif "/vehiculos/" in url:
            route.fulfill(status=200, content_type="application/json",
                          body='{"data": {}}')
        else:
            route.continue_()

    pag.route("**/vehiculos/**", ruta)
    pag.goto(f"{BASE}/PanelConductores?vista=flujo&paso=1", wait_until="networkidle")
    pag.wait_for_timeout(1500)
    info = pag.evaluate("""() => {
        const placa = document.querySelector('.pv-placa');
        const chip = document.querySelector('.estado-chip');
        const chipAprob = document.querySelector('.estado-chip--aprobado');
        const cta = document.querySelector('.pv-btn-cta');
        const card = document.querySelector('.pv-card');
        const fill = document.querySelector('.barra-progreso-bg--mini .barra-progreso-fill');
        const cs = el => el ? getComputedStyle(el) : null;
        const pc = cs(placa), cc = cs(chip), bc = cs(cta), fc = cs(card), ic = cs(fill);
        const dot = chipAprob ? getComputedStyle(chipAprob, '::before') : null;
        return {
            placa: pc && { borde: pc.borderColor, fondo: pc.backgroundColor, tracking: pc.letterSpacing },
            chip: cc && { mayusculas: cc.textTransform, color: cc.color, fondo: cc.backgroundColor },
            puntoAprobado: dot && { color: dot.backgroundColor, tamano: dot.width },
            cta: bc && { fondo: bc.backgroundColor, colorTexto: bc.color, borde: bc.borderColor },
            tarjeta: fc && { bordeIzq: fc.borderLeftWidth, sombra: fc.boxShadow.slice(0, 30) },
            progresoFill: ic && { fondo: ic.backgroundColor },
            nTarjetas: document.querySelectorAll('.pv-card').length,
        };
    }""")
    print(json.dumps(info, indent=1, ensure_ascii=False))
    pag.screenshot(path="_caps/tarjetas_redisenio.png", full_page=True)
    ctx.close()
    n.close()
print("OK (captura: _caps/tarjetas_redisenio.png)")

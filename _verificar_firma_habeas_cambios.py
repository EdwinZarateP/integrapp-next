# Verifica las secciones nuevas de la pestaña «Cambios» (2026-10-06):
# ✍️ Firma electrónica (sello + verificación + imagen) y ⚖️ Autorizaciones
# de datos (TarjetaHabeasData por actor persona). API mockeada con catch-all.
import json
import re
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/integrapp"

VEH = {
    "_id": "v1", "placa": "WOO453", "estadoIntegra": "completado_revision",
    "idUsuario": "507f1f77bcf86cd799439012",
    "condNombres": "JUAN", "condPrimerApellido": "PEREZ", "documentos": {},
    "condCedulaCiudadania": "1020304050",
    "propDocumento": "987654321", "propTipoDocumento": "CÉDULA DE CIUDADANÍA",
    "tenedTipoDocumento": "NIT", "tenedDocumento": "900123456",  # empresa: exenta
    "auditoriaVehiculo": [
        {"fecha": "2026-10-06T15:00:00", "actor": None, "via": "conductor",
         "accion": "firma_sellada", "detalle": "Versión 1"},
    ],
}

FIRMA = {
    "placa": "WOO453", "coincide": True, "hash_actual": "abc",
    "evidencia": {
        "cedula": "1020304050", "nombre": "JUAN PEREZ", "correo": "juan@x.com",
        "hash_datos": "d3447e5627790123456789012345678901234567890123456789012345678901",
        "hash_firma": "ff00d3447e5627790123456789012345678901234567890123456789012345",
        "firma_url": "https://firma.example/firma.png",
        "firmado_en": "2026-10-06T21:28:00", "ip": "190.1.2.3",
        "user_agent": "Mozilla/5.0 Android", "version": 1,
    },
}

HABEAS = {
    "personas": [
        {"cedula": "1020304050", "tiene_cuenta": True, "nombre": "JUAN PEREZ",
         "correo": "juan@x.com", "aceptaciones": [
            {"version": 2, "declaracion_titulo": "Origen de Fondos",
             "aceptado_en": "2026-10-06T14:00:00", "canal": "verificacion_correo",
             "ip": "190.1.2.3", "user_agent": "Mozilla"}]},
        {"cedula": "987654321", "tiene_cuenta": False,
         "aceptaciones": [], "token_pendiente": "sí"},
    ],
}

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    ctx.add_cookies([
        {"name": "seguridadId", "value": "s1", "url": BASE},
        {"name": "seguridadNombre", "value": "EDWIN", "url": BASE},
        {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": BASE},
    ])

    def catch_all(route):
        url = route.request.url
        if "obtener-vehiculos-incompletos" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"message": "ok", "vehicles": [VEH]}))
        elif "obtener-aprobados-paginados" in url:
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"message": "ok", "vehicles": []}))
        elif "verificar-firma" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(FIRMA))
        elif "habeas-data" in url:
            route.fulfill(status=200, content_type="application/json", body=json.dumps(HABEAS))
        else:
            route.continue_()

    ctx.route(re.compile(r"vehiculos|conductores"), catch_all)
    page = ctx.new_page()
    page.goto(f"{BASE}/revision/?bandeja=revision", wait_until="networkidle")
    page.wait_for_selector(".revx-nav-item", timeout=15000)
    page.click(".revx-nav-item:has-text('En revisión')")
    page.wait_for_selector("text=WOO453", timeout=15000)
    page.click("text=WOO453")
    page.wait_for_selector(".rev-panel", timeout=10000)
    page.click(".rev-panel-pestana:has-text('Cambios')")
    page.wait_for_timeout(1200)

    cuerpo = page.locator(".rev-panel").inner_text().lower()
    print("[1] Secciones presentes:")
    for esperado in ["firma electrónica del conductor", "autorizaciones de datos",
                     "válida — los datos del vehículo no cambiaron",
                     "juan perez · cc 1020304050", "190.1.2.3",
                     "mozilla/5.0 android"]:
        ok = esperado in cuerpo
        print(f"    {'✓' if ok else '✗'} {esperado}")
        if not ok:
            fallos.append(f"falta {esperado!r}")

    # Imagen de la firma tras el botón.
    page.click("text=Ver la imagen de la firma")
    page.wait_for_selector(".rev-firma-imagen img", timeout=5000)
    print("[2] Imagen de la firma visible tras el botón")
    page.screenshot(path="_caps/firma_habeas_cambios.png", full_page=True)

    # El tenedor NIT no debe consultar autorización (solo 2 cédulas en el query).
    browser.close()

if fallos:
    print("FALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("OK: firma electrónica + habeas data dentro de la pestaña Cambios.")

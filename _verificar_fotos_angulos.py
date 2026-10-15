# Verifica las FOTOS DEL VEHÍCULO POR ÁNGULO (2026-10-14, pedido del
# usuario: «al menos 4 fotos — FRONTAL, LATERAL IZQ Y DERECHO, POSTERIOR,
# mostrar un dibujo de ejemplo para cada foto»):
# 1. Paso 3 del conductor: 4 ítems de ángulo (obligatorios, rosadito mientras
#    falten) cada uno con su DIBUJO DE EJEMPLO (SVG) + «Fotos» pasa a opcional.
# 2. Cargar la Foto Frontal dispara subir-fotos con foto_tipo=frontal; el
#    ítem queda ✓ y muestra la MINIATURA en lugar del ejemplo.
# 3. /revision: tarjeta por ángulo con su etiqueta (faltante en rojo).
# Corre contra el build estático (junction _serve/integrapp → out).
import io
import json
import re
import sys
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = "http://localhost:4173/integrapp"

fallos = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_cookies([
        {"name": "conductorId", "value": "c1", "url": BASE},
        {"name": "conductorCorreo", "value": "TEST@X.COM", "url": BASE},
        {"name": "conductorPerfil", "value": "CONDUCTOR", "url": BASE},
    ])
    page = ctx.new_page()
    subidas = []

    VEH = {
        "placa": "ESZ744", "estadoIntegra": "registro_incompleto",
        "idUsuario": "c1", "fotos": [], "fotosVehiculo": [], "documentos": {},
        "firmaUrl": "https://x/firma", "condCedulaCiudadania": "123",
    }

    def vehiculo_con_angulos():
        import copy
        v = copy.deepcopy(vehiculo_con_angulos.base)
        return v
    vehiculo_con_angulos.base = VEH

    def mock_subir_fotos(route):
        # Multipart con bytes de imagen: decodificar como latin-1 para poder
        # buscar los campos del form (foto_tipo=...) en el cuerpo.
        subidas.append((route.request.post_data_buffer or b"").decode("latin-1"))
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"message": "ok",
                                       "rutas": ["Vehiculos/ESZ744/foto_frontal.webp"],
                                       "urls": ["https://firmada/foto_frontal"]}))

    page.route("**/vehiculos/obtener-vehiculos**",
               lambda r: r.fulfill(status=200, content_type="application/json",
                                   body=json.dumps({"message": "ok", "vehicles": [dict(VEH)]})))
    page.route("**/vehiculos/obtener-vehiculo/**",
               lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(dict(VEH))))
    page.route("**/vehiculos/subir-fotos**", mock_subir_fotos)

    # ── 1+2: paso 3 del conductor.
    page.goto(f"{BASE}/PanelConductores/?vista=flujo&paso=3&placa=ESZ744", wait_until="commit")
    page.wait_for_timeout(3500)
    # Las secciones arrancan colapsadas: expandir «1. Documentos del Vehículo».
    page.locator(".seccion-header", has_text="Documentos del Vehículo").first.click()
    page.wait_for_timeout(500)

    for nombre in ("Foto Frontal", "Foto Lateral Izquierda", "Foto Lateral Derecha", "Foto Posterior"):
        fila = page.locator(".doc-item-row", has_text=nombre).first
        if fila.count() == 0:
            fallos.append(f"no aparece el ítem «{nombre}» en paso 3")
            continue
        if "doc-item-row--falta" not in (fila.get_attribute("class") or ""):
            fallos.append(f"«{nombre}» no está marcado como faltante (rosadito)")
        if fila.locator(".pv-foto-ejemplo svg").count() == 0:
            fallos.append(f"«{nombre}» no muestra el dibujo de ejemplo")
    print("[1] 4 ítems de ángulo presentes, rosaditos y con dibujo de ejemplo"
          if not fallos else "[1] revisar fallos")

    extras = page.locator(".doc-item-row", has_text="Fotos").first
    if "opcional" not in extras.inner_text().lower():
        fallos.append("«Fotos» no quedó marcada como opcional")
    else:
        print("[2] «Fotos» pasa a opcional (adicionales)")

    # Cargar la Foto Frontal: clic en Cargar → modal → archivo (PNG real 1x1
    # para que comprimirImagen/canvas no falle con bytes basura).
    import base64
    PNG_1x1 = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
    fila_frontal = page.locator(".doc-item-row", has_text="Foto Frontal").first
    fila_frontal.locator("button", has_text="Cargar").click()
    page.wait_for_timeout(800)
    # El modal tiene 2 inputs (frente + reverso): el PRIMERO es el principal.
    input_file = page.locator("input[type=file]").first
    input_file.set_input_files(
        {"name": "frontal.png", "mimeType": "image/png", "buffer": PNG_1x1})
    page.wait_for_timeout(2500)
    if not any('name="foto_tipo"' in s and "frontal" in s for s in subidas):
        fallos.append(f"la subida no llevó foto_tipo=frontal: {subidas[:1]}")
    else:
        print("[3] subir-fotos llamado con foto_tipo=frontal")
    fila_frontal2 = page.locator(".doc-item-row", has_text="Foto Frontal").first
    if fila_frontal2.locator(".pv-foto-ejemplo img").count() == 0:
        fallos.append("el ítem frontal no muestra la miniatura tras cargar")
    else:
        print("[4] Miniatura reemplaza el dibujo en el ítem cargado")

    # ── 3: /revision con un ángulo cargado y tres faltantes (sesión Seguridad).
    ctx2 = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx2.add_cookies([
        {"name": "seguridadId", "value": "s1", "url": BASE},
        {"name": "seguridadNombre", "value": "EDWIN", "url": BASE},
        {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": BASE},
    ])
    page2 = ctx2.new_page()
    # OJO: en Playwright el ÚLTIMO route registrado gana — el catch-all va
    # PRIMERO para que el específico de la bandeja lo pise.
    page2.route(re.compile(r".*/vehiculos/.*"),
                lambda r: r.fulfill(status=200, content_type="application/json", body="{}"))
    page2.route("**/vehiculos/obtener-vehiculos-incompletos**",
                lambda r: r.fulfill(status=200, content_type="application/json",
                                    body=json.dumps({"message": "ok", "vehicles": [{
                                        **VEH, "estadoIntegra": "completado_revision",
                                        "fotosVehiculo": [{"tipo": "frontal", "ruta": "https://x/f1"}],
                                        "fotos": ["https://x/f1"], "condNombres": "JUAN",
                                        "condPrimerApellido": "PEREZ", "idUsuario": "u1",
                                    }]})))
    page2.route("**/vehiculos/obtener-aprobados-paginados**",
                lambda r: r.fulfill(status=200, content_type="application/json",
                                    body=json.dumps({"vehiculos": [], "total": 0})))
    page2.goto(f"{BASE}/revision/?bandeja=revision&placa=ESZ744&pestana=documentos", wait_until="commit")
    page2.wait_for_timeout(3000)
    panel = page2.locator(".rev-panel")
    if panel.count() == 0:
        fallos.append("/revision no abrió el panel")
    else:
        doc_faltante = page2.locator(".documento-card--falta", has_text="Lateral Izquierda")
        if doc_faltante.count() == 0:
            fallos.append("/revision no marca el ángulo faltante en rojo")
        else:
            print("[5] /revision: ángulos faltantes marcados en rojo")
        doc_ok = page2.locator(".documento-card", has_text="Foto Frontal")
        if doc_ok.count() == 0:
            fallos.append("/revision no muestra la tarjeta del ángulo cargado")
        else:
            print("[6] /revision: tarjeta del ángulo cargado presente")

    browser.close()

if fallos:
    print("\nFALLOS:")
    for f in fallos:
        print(" -", f)
    sys.exit(1)
print("\nOK: 4 ángulos con dibujo, subida con foto_tipo, miniatura y /revision etiquetado")

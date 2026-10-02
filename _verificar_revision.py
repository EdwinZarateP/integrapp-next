# Verificación visual del rediseño de /revision: sirve el export estático
# (out/) con el prefijo /integrapp mapeado, moquea la API con route()
# interceptación, y valida el shell + la pestaña Estudios por DOM y capturas.
import http.server
import socketserver
import threading
import json
from playwright.sync_api import sync_playwright

PUERTO = 8399
BASE = f"http://127.0.0.1:{PUERTO}/integrapp/revision/"

ESTUDIOS = [
    {"id": "e1", "tipo": "persona", "cedula": "1020304050",
     "roles": ["conductor", "propietario"], "estado": "finalizado",
     "proveedor": "tusdatos", "hallazgo": True, "categoria": "medio",
     "fuentes": {"PROCURADURIA": True, "SIMIT": False, "ONU": False,
                 "RUAF": "Error", "OFAC": False, "CONTRALORIA": False},
     "reporte_id": "rep-001", "iniciado_en": "2026-09-28T01:01:00",
     "finalizado_en": "2026-09-28T01:03:00"},
    {"id": "e2", "tipo": "persona", "cedula": "987654321",
     "roles": ["tenedor"], "estado": "en_curso", "proveedor": "tusdatos",
     "iniciado_en": "2026-09-28T01:01:00"},
    {"id": "e3", "tipo": "vehiculo", "placa": "ABC123", "estado": "error",
     "proveedor": "tusdatos", "error": "placa_invalida",
     "iniciado_en": "2026-09-28T01:01:00", "finalizado_en": "2026-09-28T01:02:00"},
]

# Corrida anterior (historial): el tenedor ya había sido consultado.
HISTORICO = [
    {"id": "h1", "tipo": "persona", "cedula": "987654321",
     "roles": ["tenedor"], "estado": "finalizado", "proveedor": "tusdatos",
     "hallazgo": False, "categoria": "", "fuentes": {"SIMIT": False},
     "reporte_id": "rep-viejo-1", "iniciado_en": "2026-09-10T14:00:00",
     "finalizado_en": "2026-09-10T14:02:00"},
]

VEHICULOS = [
    {"_id": "v1", "placa": "ABC123", "estadoIntegra": "completado_revision",
     "condNombres": "JUAN PEREZ", "condPrimerApellido": "GOMEZ",
     "condCedulaCiudadania": "1020304050", "fechaEstado": "2026-09-28T01:00:00",
     "estudioSeguridad": "https://firma/estudio.pdf",
     "estudioSeguridadFecha": "2026-09-15T10:00:00",
     "estudiosSeguridadAuto": ESTUDIOS},
]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory="out", **kw)

    def translate_path(self, path):
        if path.startswith("/integrapp"):
            path = path[len("/integrapp"):] or "/"
        return super().translate_path(path)

    def log_message(self, *a):
        pass


with socketserver.TCPServer(("127.0.0.1", PUERTO), Handler) as httpd:
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        navegador = p.chromium.launch()
        ctx = navegador.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_cookies([
            {"name": "seguridadId", "value": "seg1", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadNombre", "value": "EDWIN ZARATE", "url": f"http://127.0.0.1:{PUERTO}"},
            {"name": "seguridadPerfil", "value": "SEGURIDAD", "url": f"http://127.0.0.1:{PUERTO}"},
        ])
        ctx.route("**/vehiculos/obtener-vehiculos-incompletos*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"message": "ok", "vehicles": VEHICULOS})))
        ctx.route("**/vehiculos/estudios-seguridad/*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({
                "placa": "ABC123", "estudios": ESTUDIOS, "historico": HISTORICO,
                "documentos": [{"url": "https://firma/estudio.pdf",
                                "fecha": "2026-09-15T10:00:00",
                                "nombre": "estudio_mv.pdf"}],
                "vigencia": {"desde": "2026-09-28T01:00:00",
                             "vence": "2027-09-28T01:00:00"},
            })))
        ctx.route("**/vehiculos/obtener-aprobados-paginados*", lambda r: r.fulfill(
            status=200, content_type="application/json", body='{"vehiculos": []}'))

        pagina = ctx.new_page()
        pagina.goto(BASE + "?bandeja=revision", wait_until="load")
        pagina.wait_for_selector("text=ABC123", timeout=10000)

        # ── Aserciones del shell ──
        sidebar_bg = pagina.eval_on_selector(".revx-sidebar", "el => getComputedStyle(el).backgroundColor")
        sidebar_w = pagina.eval_on_selector(".revx-sidebar", "el => el.getBoundingClientRect().width")
        activo = pagina.inner_text(".revx-nav-activo")
        app_bg = pagina.eval_on_selector(".revx-app", "el => getComputedStyle(el).backgroundColor")
        print("shell: sidebar bg", sidebar_bg, "| ancho", sidebar_w, "| activo:", activo.strip())
        print("shell: fondo app", app_bg)
        assert sidebar_w == 262, "ancho de sidebar"
        assert "revisión" in activo.lower(), "nav activo"
        pagina.screenshot(path="_caps/rev_1_bandeja.png")

        # ── URL con placa: al seleccionar queda ?bandeja=…&placa=… ──
        pagina.click("text=ABC123")
        pagina.wait_for_selector(".rev-panel", timeout=5000)
        url_con_placa = pagina.url
        print("url con placa:", url_con_placa)
        assert "placa=ABC123" in url_con_placa, "placa espejada en la URL"

        # ── Recargar (F5) restaura bandeja + vehículo seleccionado ──
        pagina.reload(wait_until="load")
        pagina.wait_for_selector(".rev-panel", timeout=10000)
        placa_panel = pagina.locator(".rev-panel-titulo h3").inner_text()
        print("recarga: panel restaurado con", placa_panel)
        assert placa_panel == "ABC123", "panel restaurado tras F5"
        pagina.screenshot(path="_caps/rev_6_url_recarga.png")

        # ── Pestaña Estudios (la URL espeja ?pestana=estudios) ──
        pagina.click(".rev-panel-pestana >> text=Estudios")
        pagina.wait_for_selector(".rev-est-acciones-card", timeout=5000)
        pagina.wait_for_timeout(400)
        assert "pestana=estudios" in pagina.url, "pestana espejada en la URL"
        print("url con pestana:", pagina.url)

        # ── Pantalla grande: la columna aprovecha el ancho (mín 1000px en
        #    viewport 1440) y las tarjetas van en 2 columnas ──
        ancho_tabla = pagina.eval_on_selector(".rev-est-tabla", "el => el.getBoundingClientRect().width")
        cols = pagina.evaluate("getComputedStyle(document.querySelector('.rev-est-lista')).gridTemplateColumns")
        print("ancho: tabla", round(ancho_tabla), "| columnas tarjetas:", cols)
        assert ancho_tabla > 1000, "tabla ancha en pantalla grande"
        assert len(cols.split()) == 2, "2 columnas de tarjetas"

        # Chip de vigencia (verde "Vigente hasta el …")
        textos_acciones = pagina.locator(".rev-est-acciones-card").inner_text()
        assert "Vigente hasta el" in textos_acciones, "chip de vigencia"
        print("vigencia:", [l for l in textos_acciones.splitlines() if "Vigente" in l])

        # Tarjeta de acciones: SOLO re-consultar + cargar PDF (sin Ver
        # documento ni Reemplazar arriba — el ver está en la tabla).
        btns_acciones = pagina.locator(".rev-est-acciones-card button").all_inner_texts()
        print("acciones:", btns_acciones)
        assert any("Volver a consultar" in b for b in btns_acciones), "botón re-consultar"
        assert any("Cargar estudio" in b for b in btns_acciones), "botón cargar PDF"
        assert not any("Reemplazar" in b for b in btns_acciones), "sin botón reemplazar"
        assert not any("Ver documento" in b for b in btns_acciones), "sin ver documento arriba"
        pagina.screenshot(path="_caps/rev_5_acciones_estudios.png")

        # ── El estudio de seguridad YA NO está en Documentos ──
        pagina.click(".rev-panel-pestana >> text=Documentos")
        pagina.wait_for_timeout(300)
        textos_docs = pagina.locator(".rev-detalle-scroll").inner_text()
        assert "Estudio de Seguridad" not in textos_docs, "sin estudio en Documentos"
        print("documentos: estudio de seguridad fuera de la pestaña OK")
        pagina.click(".rev-panel-pestana >> text=Estudios")
        pagina.wait_for_selector(".rev-est-acciones-card", timeout=5000)

        tarjetas = pagina.locator(".rev-est-card").count()
        semaforos = [t.strip() for t in pagina.locator(".rev-est-sem").all_inner_texts()]
        titulo1 = pagina.locator(".rev-est-card .rev-est-titulo strong").first.inner_text()
        print("estudios: tarjetas", tarjetas, "| semáforos", semaforos, "| título1", titulo1)
        assert tarjetas == 3, "3 tarjetas de estudio"
        assert any("Hallazgo MEDIO" == t for t in semaforos) and any("Consultando" in t for t in semaforos), "semáforos"
        assert titulo1 == "Conductor · Propietario", "roles combinados"

        # ── Historial: tabla con fecha + botón Abrir (documento subido +
        #    corrida vieja + vigente) ──
        filas_h = pagina.locator(".rev-est-tabla tbody tr").count()
        fecha_h = pagina.locator(".rev-est-tabla-fecha").first.inner_text()
        btns_abrir = pagina.locator(".rev-est-btn-tabla").count()
        textos_tabla = pagina.locator(".rev-est-tabla").inner_text()
        print("historial: filas", filas_h, "| primera fecha", fecha_h, "| botones abrir", btns_abrir)
        assert filas_h == 3, "3 documentos (subido + histórico + vigente)"
        assert btns_abrir == 3, "botón abrir por fila"
        assert "Documento del estudio" in textos_tabla, "documento subido en la tabla"
        pagina.screenshot(path="_caps/rev_7_historial.png")

        # Expandir fuentes del primero (el botón literal «Fuentes…» es el
        # ÚLTIMO que contiene esa palabra: el de reintentar va antes).
        # Solo lista las fuentes CAÍDAS (en el mock de e1: RUAF "Error").
        pagina.locator('.rev-est-card button:has-text("Fuentes")').last.click()
        pagina.wait_for_selector(".rev-est-fuente--caida", timeout=3000)
        n_fuentes = pagina.locator(".rev-est-fuente").count()
        print("estudios: fuentes caídas listadas", n_fuentes)
        assert n_fuentes == 1, "solo la fuente caída (RUAF)"
        pdf_btn = pagina.locator(".rev-est-card .rev-est-btn-pdf").count()
        assert pdf_btn == 1, "botón PDF solo en finalizados con reporte_id"
        pagina.screenshot(path="_caps/rev_2_estudios.png")

        # ── Menú de usuario (cerrar antes el panel fullscreen) ──
        pagina.click(".rev-panel-volver")
        pagina.wait_for_selector(".rev-panel", state="detached", timeout=5000)
        pagina.click(".revx-avatar-boton")
        pagina.wait_for_selector(".revx-avatar-menu", timeout=3000)
        menu_items = pagina.locator(".revx-avatar-item").all_inner_texts()
        print("menú usuario:", menu_items)
        assert any("Cerrar sesión" in t for t in menu_items)
        pagina.screenshot(path="_caps/rev_3_menu.png")
        pagina.keyboard.press("Escape")

        # ── Móvil: hamburguesa → drawer ──
        mov = ctx.new_page()
        mov.set_viewport_size({"width": 390, "height": 844})
        mov.goto(BASE, wait_until="load")
        mov.wait_for_selector("text=ABC123", timeout=10000)
        sidebar_esc_visible = mov.eval_on_selector(
            ".revx-sidebar-escritorio", "el => getComputedStyle(el).display")
        hamburguesa = mov.eval_on_selector(
            ".revx-hamburguesa", "el => getComputedStyle(el).display")
        print("movil: sidebar escritorio display:", sidebar_esc_visible, "| hamburguesa:", hamburguesa)
        assert sidebar_esc_visible == "none" and hamburguesa != "none"
        mov.click(".revx-hamburguesa")
        mov.wait_for_selector(".revx-sidebar-movil", timeout=3000)
        mov.screenshot(path="_caps/rev_4_movil_drawer.png")
        print("movil: drawer OK")

        # ── Módulo «Alta conductor» (/revision/alta): sidebar item + form ──
        pagina2 = ctx.new_page()
        pagina2.goto(f"http://127.0.0.1:{PUERTO}/integrapp/revision/alta", wait_until="load")
        pagina2.wait_for_selector(".revx-alta", timeout=8000)
        assert "Alta de" in pagina2.locator(".revx-encabezado h1").inner_text()
        activo_alta = pagina2.inner_text(".revx-nav-activo")
        inputs = pagina2.locator(".revx-alta-grid input, .revx-alta-grid select").count()
        print("alta: nav activo:", activo_alta.strip(), "| campos:", inputs)
        assert "Alta conductor" in activo_alta, "módulo activo en sidebar"
        assert inputs >= 5, "form del alta"
        # Volver a bandejas: click en «En revisión» → URL con ?bandeja=
        pagina2.locator('.revx-nav-item:has-text("En revisión")').click()
        pagina2.wait_for_selector(".revx-bandeja", timeout=8000)
        assert "bandeja=revision" in pagina2.url
        # Alternar varias veces NO debe acumular barras (bug de la base).
        for _ in range(3):
            pagina2.locator('.revx-nav-item:has-text("Alta conductor")').click()
            pagina2.wait_for_selector(".revx-alta", timeout=8000)
            pagina2.locator('.revx-nav-item:has-text("En revisión")').click()
            pagina2.wait_for_selector(".revx-bandeja", timeout=8000)
        assert "//" not in pagina2.url.replace("://", ""), f"barras acumuladas: {pagina2.url}"
        print("alta: volver a bandejas OK (sin // acumuladas) ->", pagina2.url)
        pagina2.screenshot(path="_caps/rev_8_alta.png")
        navegador.close()

print("VERIFICACION VISUAL OK")

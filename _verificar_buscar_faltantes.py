# Verificación de los 3 cambios de 2026-10-21 en /revision:
#   (1) Botón «Buscar» en TODAS las bandejas (el filtro NO se aplica al teclear,
#       solo con clic/Enter — antes pendientes/revision filtraban en vivo).
#   (2) La alerta de faltantes NO aparece por campos opcionales: EXX729 sin
#       2º apellido (opcional desde 2026-10-14) no debe generar advertencia.
#   (3) Títulos de sección de la pestaña Datos con sombreado leve.
import http.server
import socketserver
import threading
import json
from playwright.sync_api import sync_playwright

PUERTO = 8403
BASE = f"http://127.0.0.1:{PUERTO}/integrapp/revision/"

# Vehículo COMPLETO salvo el 2º apellido (opcional) → NO debe alertar.
COMPLETO = {
    "_id": "v1", "placa": "EXX729", "estadoIntegra": "aprobado",
    "condPrimerApellido": "MARTINEZ", "condSegundoApellido": "",
    "condNombres": "CARLOS", "condCedulaCiudadania": "1020304050",
    "condExpedidaEn": "BOGOTA", "condDireccion": "CLL 1 2-34",
    "condCiudad": "BOGOTA", "condCelular": "3001234567",
    "condCorreo": "CARLOS@X.COM", "condEps": "Sanitas", "condArl": "Positiva",
    "condNoLicencia": "12345", "condFechaVencimientoLic": "2028-01-01",
    "condCategoriaLic": "C1", "condGrupoSanguineo": "O+",
    "condNombreEmergencia": "MARIA", "condCelularEmergencia": "3009876543",
    "condParentescoEmergencia": "Hermana",
    "condEmpresaRef": "TRANS X", "condCelularRef": "3011112222",
    "condCiudadRef": "MEDELLIN", "condNroViajesRef": "10",
    "condAntiguedadRef": "3", "condMercTransportada": "CARGA SECA",
    "propNombre": "CARLOS MARTINEZ", "propDocumento": "1020304050",
    "propCiudadExpDoc": "BOGOTA", "propCorreo": "CARLOS@X.COM",
    "propCelular": "3001234567", "propDireccion": "CLL 1 2-34",
    "propCiudad": "BOGOTA",
    "tenedNombre": "EMPRESA Y", "tenedDocumento": "900123456",
    "tenedTipoDocumento": "NIT", "tenedCorreo": "", "tenedCelular": "",
    "tenedDireccion": "", "tenedCiudad": "", "tenedCiudadExpDoc": "",
    "vehModelo": "2015", "vehMarca": "CHEVROLET", "vehTipoCarroceria": "PLATAFORMA",
    "vehLinea": "NPR", "vehColor": "BLANCO", "vehCapacidadCarga": "8000",
    "vehEmpresaSat": "SAT", "vehUsuarioSat": "USER", "vehClaveSat": "CLAVE",
    "documentoIdentidadConductor": "firma/ced.webp", "licencia": "firma/lic.pdf",
    "tarjetaPropiedad": "firma/tp.webp", "soat": "firma/soat.webp",
    "revisionTecnomecanica": "firma/tm.webp", "firmaUrl": "firma/firma.webp",
    "fechaEstado": "2026-10-01T01:00:00",
}

# Igual al completo pero SIN correo del conductor (obligatorio) → SÍ alerta.
INCOMPLETO = dict(COMPLETO)
INCOMPLETO.update({
    "_id": "v2", "placa": "XYZ999", "estadoIntegra": "registro_incompleto",
    "condCorreo": "", "soat": "",
})

PENDIENTES = [INCOMPLETO,
              dict(COMPLETO, _id="v3", placa="QQQ777", estadoIntegra="registro_incompleto")]
APROBADOS = [COMPLETO]


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

        def incompletos(r):
            q = (r.request.url.split("?")[1] if "?" in r.request.url else "")
            if "placa=" in q:
                placa = [p.split("=")[1] for p in q.split("&") if p.startswith("placa=")][0]
                lista = [v for v in PENDIENTES + APROBADOS if v["placa"] == placa.upper()]
                r.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"message": "ok", "vehicles": lista}))
            else:
                r.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"message": "ok", "vehicles": PENDIENTES}))

        ctx.route("**/vehiculos/obtener-vehiculos-incompletos*", incompletos)
        ctx.route("**/vehiculos/obtener-aprobados-paginados*", lambda r: r.fulfill(
            status=200, content_type="application/json",
            body=json.dumps({"vehiculos": APROBADOS, "total": 1})))

        pagina = ctx.new_page()

        # ═══ (1) Buscar con botón en PENDIENTES ══════════════════════════
        pagina.goto(BASE + "?bandeja=pendientes", wait_until="load")
        pagina.wait_for_selector("text=QQQ777", timeout=10000)
        n_inicial = pagina.locator(".rev-tabla-bandeja tbody tr").count()
        assert n_inicial == 2, f"esperaba 2 filas, hay {n_inicial}"

        # Teclear NO filtra hasta Buscar.
        pagina.fill(".rev-input-busqueda", "QQQ")
        pagina.wait_for_timeout(500)
        n_tecleando = pagina.locator(".rev-tabla-bandeja tbody tr").count()
        print(f"(1) filas al teclear 'QQQ' (sin Buscar): {n_tecleando}")
        assert n_tecleando == 2, "el filtro se aplicó al teclear (debe esperar Buscar)"

        btn_buscar = pagina.locator(".rev-btn-buscar")
        assert btn_buscar.count() == 1 and btn_buscar.is_visible(), "botón Buscar visible en pendientes"
        btn_buscar.click()
        pagina.wait_for_timeout(400)
        n_busqueda = pagina.locator(".rev-tabla-bandeja tbody tr").count()
        print(f"(1) filas tras Buscar 'QQQ': {n_busqueda}")
        assert n_busqueda == 1, "Buscar no filtró"

        # Limpiar restaura las 2.
        pagina.click(".rev-btn-clear")
        pagina.wait_for_timeout(400)
        assert pagina.locator(".rev-tabla-bandeja tbody tr").count() == 2, "limpiar no restauró"
        print("(1) limpiar restaura la bandeja OK")

        # ═══ (2) EXX729 aprobado: sin alerta de faltantes ════════════════
        pagina.goto(BASE + "?bandeja=aprobados&placa=EXX729", wait_until="load")
        pagina.wait_for_selector(".rev-panel", timeout=10000)
        pagina.wait_for_timeout(600)
        datos_txt = pagina.locator(".rev-detalle-scroll").inner_text()
        assert "Falta información para completar el trámite" not in datos_txt, \
            "alerta falsa: aparece pidiendo datos opcionales en EXX729"
        print("(2) EXX729 sin 2º apellido: SIN alerta de faltantes OK")

        # ═══ (3) Sombreado de títulos de sección ════════════════════════
        titulos = pagina.locator(".rev-seccion-titulo")
        assert titulos.count() >= 5, "secciones de la pestaña Datos"
        bg = pagina.eval_on_selector(".rev-seccion-titulo", "el => getComputedStyle(el).backgroundColor")
        print(f"(3) título de sección con fondo: {bg}")
        assert bg not in ("rgba(0, 0, 0, 0)", "transparent"), "título sin sombreado"
        pagina.screenshot(path="_caps/faltantes_exx729_sin_alerta.png")

        # ═══ (2b) Contraste: falta un campo OBLIGATORIO → SÍ alerta ══════
        pagina.goto(BASE + "?bandeja=pendientes&placa=XYZ999", wait_until="load")
        pagina.wait_for_selector(".rev-panel", timeout=10000)
        pagina.wait_for_timeout(600)
        datos_txt = pagina.locator(".rev-detalle-scroll").inner_text()
        assert "Falta información para completar el trámite" in datos_txt, \
            "debe alertar: faltan el SOAT y el correo (obligatorios)"
        # El detalle del Swal ya no incluye el 2º apellido (opcional).
        pagina.locator("button:has-text('Ver detalle')").click()
        pagina.wait_for_selector(".swal2-popup", timeout=3000)
        swal_txt = pagina.locator(".swal2-popup").inner_text()
        print("(2b) Swal de faltantes:", [l for l in swal_txt.splitlines() if l.strip()][:8])
        assert "2do apellido" not in swal_txt, "el 2º apellido (opcional) sigue en el detalle"
        assert "Correo del conductor" in swal_txt, "falta el correo obligatorio en el detalle"
        assert "SOAT" in swal_txt, "falta el SOAT en el detalle"
        navegador.close()

print("VERIFICACION OK")
